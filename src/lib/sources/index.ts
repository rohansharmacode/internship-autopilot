import type { Board, Job, Source } from "../types";
import { fetchAshby } from "./ashby";
import { fetchGreenhouse } from "./greenhouse";
import { fetchLever } from "./lever";

const FETCHERS: Record<Source, (board: string) => Promise<Job[]>> = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
};

export async function fetchAllBoards(boards: Board[]): Promise<{ jobs: Job[]; errors: string[] }> {
  const results = await Promise.allSettled(boards.map((b) => FETCHERS[b.source](b.token)));
  const jobs: Job[] = [];
  const errors: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") jobs.push(...r.value);
    else errors.push(`${boards[i].source}/${boards[i].token}: ${(r.reason as Error).message}`);
  });
  return { jobs, errors };
}

/** Works out the source and board from a job-board link someone pastes in. */
export function boardFromUrl(url: string): Board | null {
  const m =
    url.match(/(?:job-boards|boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([\w-]+)/i) ??
    url.match(/boards-api\.greenhouse\.io\/v1\/boards\/([\w-]+)/i);
  if (m) return { source: "greenhouse", token: m[1].toLowerCase() };
  const l = url.match(/jobs\.lever\.co\/([\w-]+)/i);
  if (l) return { source: "lever", token: l[1].toLowerCase() };
  const a = url.match(/jobs\.ashbyhq\.com\/([\w.-]+)/i);
  if (a) return { source: "ashby", token: a[1] };
  return null;
}
