import { promises as fs } from "node:fs";
import path from "node:path";
import { aiAvailable, draftApplication, templateCoverLetter } from "./ai";
import { autoFill } from "./fill";
import { loadForm } from "./forms";
import { scoreJob } from "./match";
import { fetchAllBoards } from "./sources";
import { DATA_DIR, FILES_DIR, newId, readDb, updateDb } from "./store";
import { fillAndSubmit } from "./submit";
import type { Application, FormField } from "./types";

export async function refreshJobs(): Promise<{ added: number; total: number; errors: string[] }> {
  const { settings } = await readDb();
  const { jobs, errors } = await fetchAllBoards(settings.boards);
  return updateDb((db) => {
    const existing = new Map(db.jobs.map((j) => [j.id, j]));
    let added = 0;
    for (const job of jobs) {
      const prev = existing.get(job.id);
      if (!prev) added++;
      const { score, reasons } = scoreJob(job, db.profile);
      existing.set(job.id, { ...job, score, reasons, hidden: prev?.hidden });
    }
    // Postings that disappeared from their board are closed; keep them only if you already applied.
    const live = new Set(jobs.map((j) => j.id));
    const applied = new Set(db.applications.map((a) => a.jobId));
    const failedBoards = new Set(errors.map((e) => e.split(":")[0]));
    db.jobs = [...existing.values()].filter(
      (j) => live.has(j.id) || applied.has(j.id) || failedBoards.has(`${j.source}/${j.board}`),
    );
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
export async function prepareApplication(jobId: string): Promise<Application> {
  const db = await readDb();
  const already = db.applications.find((a) => a.jobId === jobId && a.status !== "skipped");
  if (already) return already;
  const job = db.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error("That internship is no longer listed.");

  const log: string[] = [];
  let fields = autoFill(await loadForm(job), db.profile);
  let coverLetter = "";

  const open = fields.filter((f) => f.source === "empty" && DRAFTABLE.has(f.type) && !/pronunciation|pronoun/i.test(f.label));
  if (aiAvailable()) {
    try {
      const draft = await draftApplication(db.profile, job, open);
      coverLetter = draft.coverLetter;
      const byKey = new Map(draft.answers.map((a) => [a.key, a]));
      fields = fields.map((f) => {
        const a = byKey.get(f.key);
        if (!a || f.source !== "empty") return f;
        const valid = !f.options?.length || a.value.split("\n").every((v) => f.options!.some((o) => o.label === v));
        return a.value && valid ? { ...f, value: a.value, source: "ai", note: a.note || undefined } : { ...f, note: a.note || undefined };
      });
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
  const app: Application = { id: newId(), jobId, status: "draft", fields, coverLetter, createdAt: now, updatedAt: now, log };
  await updateDb((d) => {
    d.applications.push(app);
  });
  return app;
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

function sentToday(apps: Application[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return apps.filter((a) => a.status === "submitted" && a.submittedAt?.startsWith(today)).length;
}

const running = new Set<string>();

/**
 * Sends an approved application in the background. The page refreshes while it runs.
 * Returns an error message when it cannot start.
 */
export async function sendApplication(id: string): Promise<string | null> {
  const db = await readDb();
  const app = db.applications.find((a) => a.id === id);
  const job = app && db.jobs.find((j) => j.id === app.jobId);
  if (!app || !job) return "Application not found.";
  if (running.has(id)) return "It is already being sent.";
  if (!db.profile.cv) return "Upload your CV on the Profile page first.";
  if (!db.settings.rehearsal && sentToday(db.applications) >= db.settings.dailyLimit) {
    return `You've reached today's limit of ${db.settings.dailyLimit} applications. Change it in Settings.`;
  }

  running.add(id);
  await setStatus(id, "sending");

  const coverPath = path.join(FILES_DIR, `cover-letter-${app.id}.txt`);
  await fs.mkdir(FILES_DIR, { recursive: true });
  await fs.writeFile(coverPath, app.coverLetter);
  const screenshot = path.join(DATA_DIR, "screens", `${app.id}.png`);

  void fillAndSubmit({
    source: job.source,
    url: job.applyUrl,
    fields: app.fields,
    files: { resume: db.profile.cv.storedPath, cover_letter: coverPath },
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
  return null;
}
