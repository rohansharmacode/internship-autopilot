import { prepareBest, refreshJobs, sentTodayCount, startSending } from "./applications";
import { missingRequired } from "./fill";
import { readDb, updateDb } from "./store";
import type { Application, Job, Settings } from "./types";

/**
 * Autopilot may only send an application nobody has read when nothing in it was invented:
 * every required answer came from your profile or from an answer you wrote before.
 */
export function autoSendBlocker(app: Application, job: Job | undefined, settings: Settings): string | null {
  if (!job) return "the posting has closed";
  if (job.source === "external") return "the site can't be filled in";
  if ((job.score ?? 0) < settings.autopilot.autoSendMinScore) return `match score ${job.score ?? 0} is below ${settings.autopilot.autoSendMinScore}`;
  const missing = missingRequired(app.fields);
  if (missing.length) return `${missing.length} required answer${missing.length === 1 ? " is" : "s are"} empty`;
  const drafted = app.fields.filter((f) => f.required && f.source === "ai");
  if (drafted.length) return `"${drafted[0].label}" needs your check`;
  return null;
}

const shared = globalThis as typeof globalThis & { __autopilotRun?: { busy: boolean; timer?: ReturnType<typeof setInterval> } };
const state = (shared.__autopilotRun ??= { busy: false });

async function note(line: string): Promise<void> {
  await updateDb((db) => {
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    db.settings.autopilot.log = [...db.settings.autopilot.log, `${stamp}  ${line}`].slice(-40);
  });
}

/** One autopilot round: search, prepare the best new matches, and send the ones that qualify. */
export async function runAutopilot(): Promise<void> {
  if (state.busy) return;
  state.busy = true;
  try {
    await updateDb((db) => {
      db.settings.autopilot.lastRunAt = new Date().toISOString();
    });
    const found = await refreshJobs();
    const { settings } = await readDb();
    const { started, finished } = await prepareBest(settings.autopilot.prepareCount, true);
    const made = await finished;
    await note(`Searched: ${found.added} new internships. Prepared ${made.length} of ${started} drafts.`);
    if (!settings.autopilot.autoSend) return;

    for (const app of made) {
      const db = await readDb();
      if (!db.settings.rehearsal && sentTodayCount(db.applications) >= db.settings.dailyLimit) {
        await note("Reached today's limit; the rest wait for you.");
        break;
      }
      const job = db.jobs.find((j) => j.id === app.jobId);
      const fresh = db.applications.find((a) => a.id === app.id) ?? app;
      const blocker = autoSendBlocker(fresh, job, db.settings);
      if (blocker) {
        await note(`Left for you: ${job?.company} – ${job?.title} (${blocker}).`);
        continue;
      }
      const { error, done } = await startSending(app.id);
      if (error) {
        await note(`Could not send ${job?.company}: ${error}`);
        continue;
      }
      await done;
      const after = (await readDb()).applications.find((a) => a.id === app.id);
      await note(`Sent ${job?.company} – ${job?.title}: ${after?.status === "submitted" ? "confirmed by the site" : after?.status}.`);
    }
  } catch (err) {
    await note(`Stopped with an error: ${(err as Error).message}`);
  } finally {
    state.busy = false;
  }
}

export function autopilotBusy(): boolean {
  return state.busy;
}

/** Checks every ten minutes whether a round is due. Started once when the server starts. */
export function startAutopilotClock(): void {
  if (state.timer) return;
  state.timer = setInterval(async () => {
    const { settings } = await readDb().catch(() => ({ settings: null }));
    const a = settings?.autopilot;
    if (!a?.enabled) return;
    const due = !a.lastRunAt || Date.now() - Date.parse(a.lastRunAt) >= a.everyHours * 3600_000;
    if (due) void runAutopilot();
  }, 10 * 60_000);
  state.timer.unref?.();
}
