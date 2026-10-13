import { htmlToText } from "../text";
import type { Job } from "../types";

/** Fetches the full posting text for jobs found through the community list, which only has titles. */
export async function loadDescription(job: Job): Promise<string> {
  try {
    if (job.source === "greenhouse") {
      const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${job.board}/jobs/${job.externalId}`);
      if (r.ok) return htmlToText(((await r.json()) as { content?: string }).content ?? "");
    }
    if (job.source === "lever") {
      const r = await fetch(`https://api.lever.co/v0/postings/${job.board}/${job.externalId}`);
      if (r.ok) {
        const p = (await r.json()) as { descriptionPlain?: string; additionalPlain?: string; lists?: { text: string; content: string }[] };
        return [p.descriptionPlain, ...(p.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`), p.additionalPlain].filter(Boolean).join("\n\n");
      }
    }
    if (job.source === "ashby") {
      const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(job.board)}`);
      if (r.ok) {
        const body = (await r.json()) as { jobs: { id: string; descriptionPlain?: string }[] };
        return body.jobs.find((j) => j.id === job.externalId)?.descriptionPlain ?? "";
      }
    }
  } catch {
    // The posting text only improves drafting; carry on without it.
  }
  return "";
}
