import { promises as fs } from "node:fs";
import path from "node:path";
import { aiAvailable, draftApplication, templateCoverLetter } from "./ai";
import { applyDraft } from "./draft";
import { autoFill, rememberAnswers } from "./fill";
import { loadForm, PostingClosedError } from "./forms";
import { scoreJob } from "./match";
import { fetchAllBoards } from "./sources";
import { fetchCommunityList } from "./sources/community";
import { loadDescription } from "./sources/describe";
import { DATA_DIR, FILES_DIR, newId, readDb, updateDb } from "./store";
import { fillAndSubmit, writeCoverLetterPdf } from "./submit";
import type { Application, FormField, Job } from "./types";

export async function refreshJobs(): Promise<{ added: number; total: number; errors: string[] }> {
  const { settings } = await readDb();
  const [boards, community] = await Promise.all([
    fetchAllBoards(settings.boards),
    settings.communityList
      ? fetchCommunityList().then(
          (jobs) => ({ jobs, error: null as string | null }),
          (err: Error) => ({ jobs: [] as Job[], error: `community list: ${err.message}` }),
        )
      : Promise.resolve({ jobs: [] as Job[], error: null }),
  ]);
  const errors = [...boards.errors, ...(community.error ? [community.error] : [])];

  // A company's own board has the full description, so it wins over the community copy of the same posting.
  const fresh = new Map<string, Job>();
  for (const j of community.jobs) fresh.set(j.id, j);
  for (const j of boards.jobs) fresh.set(j.id, j);

  return updateDb((db) => {
    const now = new Date().toISOString();
    const existing = new Map(db.jobs.map((j) => [j.id, j]));
    let added = 0;
    for (const job of fresh.values()) {
      const prev = existing.get(job.id);
      if (!prev) added++;
      const merged: Job = {
        ...job,
        description: job.description.length >= (prev?.description.length ?? 0) ? job.description : prev!.description,
        firstSeenAt: prev?.firstSeenAt ?? now,
        hidden: prev?.hidden,
      };
      existing.set(job.id, { ...merged, ...scoreJob(merged, db.profile) });
    }
    // Postings that disappeared are closed; keep them only if you applied, or if their feed failed this time.
    const applied = new Set(db.applications.map((a) => a.jobId));
    const failed = new Set(errors.map((e) => e.split(":")[0]));
    db.jobs = [...existing.values()].filter(
      (j) =>
        fresh.has(j.id) ||
        applied.has(j.id) ||
        (j.via === "community" ? failed.has("community list") : failed.has(`${j.source}/${j.board}`)),
    );
    db.settings.lastSearchAt = now;
    return { added, total: db.jobs.length, errors };
  });
}

export async function rescoreJobs(): Promise<void> {
  await updateDb((db) => {
    db.jobs = db.jobs.map((j) => ({ ...j, ...scoreJob(j, db.profile) }));
  });
}

const DRAFTABLE = new Set<FormField["type"]>(["text", "textarea", "select", "multiselect"]);

/** Loads the real application form for a job, fills it from the profile and drafts the rest. */
export async function prepareApplication(jobId: string, byAutopilot = false): Promise<Application> {
  const db = await readDb();
  const already = db.applications.find((a) => a.jobId === jobId && a.status !== "skipped");
  if (already) return already;
  let job = db.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error("That internship is no longer listed.");

  const log: string[] = [];
  let form: FormField[];
  try {
    form = await loadForm(job);
  } catch (err) {
    if (err instanceof PostingClosedError) {
      await updateDb((d) => {
        d.jobs = d.jobs.filter((j) => j.id !== jobId);
      });
    }
    throw err;
  }
  let fields = autoFill(form, db.profile);
  let coverLetter = "";

  if (job.description.length < 200) {
    const description = await loadDescription(job);
    if (description) {
      job = { ...job, description };
      await updateDb((d) => {
        const j = d.jobs.find((x) => x.id === jobId);
        if (j) Object.assign(j, { description }, scoreJob({ ...j, description }, d.profile));
      });
    }
  }

  const open = fields.filter((f) => f.source === "empty" && DRAFTABLE.has(f.type) && !/pronunciation|pronoun/i.test(f.label));
  if (aiAvailable()) {
    try {
      const draft = await draftApplication(db.profile, job, open);
      coverLetter = draft.coverLetter;
      fields = applyDraft(fields, draft.answers);
      log.push("Drafted the cover letter and open questions with Claude.");
    } catch (err) {
      log.push(`Claude could not draft answers: ${(err as Error).message}`);
    }
  }
  if (!coverLetter) {
    coverLetter = templateCoverLetter(db.profile, job);
    log.push("Used the cover letter template (set ANTHROPIC_API_KEY for tailored letters).");
  }
  fields = fields.map((f) =>
    /cover letter/i.test(f.label) && f.type !== "file" && !f.value ? { ...f, value: coverLetter, source: "ai" } : f,
  );

  const now = new Date().toISOString();
  const app: Application = { id: newId(), jobId, status: "draft", fields, coverLetter, createdAt: now, updatedAt: now, log, byAutopilot: byAutopilot || undefined };
  return updateDb((d) => {
    // Another request may have prepared the same job while this one was drafting.
    const raced = d.applications.find((a) => a.jobId === jobId && a.status !== "skipped");
    if (raced) return raced;
    d.applications.push(app);
    return app;
  });
}

/** Progress of "Prepare the best matches", shown on the Applications page while it runs. */
// Kept on globalThis because Next.js may load this module more than once in one server (pages and the autopilot clock).
const shared = globalThis as typeof globalThis & {
  __autopilotBatch?: { running: boolean; total: number; done: number; failed: string[] };
  __autopilotSending?: Set<string>;
};
export const batch = (shared.__autopilotBatch ??= { running: false, total: 0, done: 0, failed: [] });

export function autoApplicable(job: Job): boolean {
  return job.source !== "external";
}

export function bestUnseen(db: Awaited<ReturnType<typeof readDb>>, count: number): Job[] {
  const taken = new Set(db.applications.map((a) => a.jobId));
  return db.jobs
    .filter((j) => !j.hidden && autoApplicable(j) && !taken.has(j.id) && (j.score ?? 0) >= db.profile.preferences.minScore)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, count);
}

/** Prepares drafts for the best-scoring internships you haven't looked at yet, one after another. */
export async function prepareBest(count: number, byAutopilot = false): Promise<{ started: number; finished: Promise<Application[]> }> {
  if (batch.running) return { started: 0, finished: Promise.resolve([]) };
  const picks = bestUnseen(await readDb(), count);
  Object.assign(batch, { running: true, total: picks.length, done: 0, failed: [] });
  const finished = (async () => {
    const made: Application[] = [];
    for (const job of picks) {
      try {
        made.push(await prepareApplication(job.id, byAutopilot));
      } catch (err) {
        batch.failed.push(`${job.company}: ${(err as Error).message}`);
      }
      batch.done++;
    }
    batch.running = false;
    return made;
  })();
  return { started: picks.length, finished };
}

export async function saveAnswers(id: string, values: Record<string, string>, coverLetter: string): Promise<void> {
  await updateDb((db) => {
    const app = db.applications.find((a) => a.id === id);
    if (!app) throw new Error("Application not found");
    app.fields = app.fields.map((f) =>
      f.key in values && values[f.key] !== f.value ? { ...f, value: values[f.key], source: "you", note: undefined } : f,
    );
    app.coverLetter = coverLetter;
    app.updatedAt = new Date().toISOString();
    const company = db.jobs.find((j) => j.id === app.jobId)?.company ?? "";
    db.profile.savedAnswers = rememberAnswers(db.profile, app.fields, company);
  });
}

export async function setStatus(id: string, status: Application["status"]): Promise<void> {
  await updateDb((db) => {
    const app = db.applications.find((a) => a.id === id);
    if (app) {
      app.status = status;
      app.updatedAt = new Date().toISOString();
    }
  });
}

/** Records an application you sent yourself, for postings on sites the app can't fill in. */
export async function recordManualApplication(jobId: string): Promise<string> {
  return updateDb((db) => {
    const now = new Date().toISOString();
    const app: Application = {
      id: newId(),
      jobId,
      status: "submitted",
      fields: [],
      coverLetter: "",
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
      log: ["You applied on the company's site."],
    };
    db.applications.push(app);
    return app.id;
  });
}

function sentToday(apps: Application[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return apps.filter((a) => a.status === "submitted" && a.submittedAt?.startsWith(today) && a.fields.length > 0).length;
}

const running = (shared.__autopilotSending ??= new Set<string>());
let recovered = false;

/** After a restart nothing is really sending any more, so those applications are handed back to you. */
export async function recoverInterrupted(): Promise<void> {
  if (recovered) return;
  recovered = true;
  await updateDb((db) => {
    for (const a of db.applications) {
      if (a.status === "sending" && !running.has(a.id)) {
        a.status = "needs_you";
        a.log.push("The app stopped while sending this. Check the company's site, then send it again or mark it submitted.");
      }
    }
  });
}

/**
 * Sends an approved application in the background. The page refreshes while it runs.
 * Returns an error message when it cannot start.
 */
export async function sendApplication(id: string): Promise<string | null> {
  return (await startSending(id)).error;
}

export async function startSending(id: string): Promise<{ error: string | null; done: Promise<unknown> }> {
  const fail = (error: string) => ({ error, done: Promise.resolve() });
  const db = await readDb();
  const app = db.applications.find((a) => a.id === id);
  const job = app && db.jobs.find((j) => j.id === app.jobId);
  if (!app || !job) return fail("Application not found.");
  if (job.source === "external") return fail("The app can't fill in this site. Apply on the company's page.");
  if (running.has(id)) return fail("It is already being sent.");
  if (!db.profile.cv) return fail("Upload your CV on the Profile page first.");
  if (!db.settings.rehearsal && sentToday(db.applications) >= db.settings.dailyLimit) {
    return fail(`You've reached today's limit of ${db.settings.dailyLimit} applications. Change it in Settings.`);
  }

  running.add(id);
  await setStatus(id, "sending");
  const done = launchSend(app, job, db.profile.cv.storedPath, db).catch((err: Error) =>
    updateDb((d) => {
      running.delete(id);
      const a = d.applications.find((x) => x.id === id);
      if (a) {
        a.status = "needs_you";
        a.log.push(`Could not start sending: ${err.message}`);
      }
    }),
  );
  return { error: null, done };
}

async function launchSend(app: Application, job: Job, resume: string, db: Awaited<ReturnType<typeof readDb>>): Promise<unknown> {
  const id = app.id;
  if (job.source === "external") throw new Error("This site can't be filled in.");
  await fs.mkdir(FILES_DIR, { recursive: true });
  const name = `${db.profile.firstName} ${db.profile.lastName} cover letter ${job.company}`.trim().replace(/[^\w -]+/g, "").replace(/\s+/g, "-");
  let coverPath = path.join(FILES_DIR, `${name}.pdf`);
  try {
    await writeCoverLetterPdf(app.coverLetter, coverPath);
  } catch {
    coverPath = path.join(FILES_DIR, `${name}.txt`);
    await fs.writeFile(coverPath, app.coverLetter);
  }
  const screenshot = path.join(DATA_DIR, "screens", `${app.id}.png`);
  const source = job.source;

  const done = fillAndSubmit({
    source,
    url: job.applyUrl,
    fallbackUrl:
      source === "greenhouse" ? `https://job-boards.greenhouse.io/embed/job_app?for=${job.board}&token=${job.externalId}` : undefined,
    fields: app.fields,
    files: { resume, cover_letter: coverPath },
    rehearsal: db.settings.rehearsal,
    headed: db.settings.showBrowser,
    screenshotPath: screenshot,
  })
    .catch((err: Error) => ({ status: "failed" as const, log: [`Browser error: ${err.message.split("\n")[0]}`] }))
    .then((result) =>
      updateDb((d) => {
        const a = d.applications.find((x) => x.id === id);
        if (!a) return;
        const now = new Date().toISOString();
        a.status = result.status;
        a.log = [...a.log, `— ${now.slice(0, 16).replace("T", " ")}`, ...result.log];
        a.screenshot = `${a.id}.png`;
        a.updatedAt = now;
        if (result.status === "submitted") a.submittedAt = now;
      }),
    )
    .finally(() => running.delete(id));
  return done;
}

export function sentTodayCount(apps: Application[]): number {
  return sentToday(apps);
}
