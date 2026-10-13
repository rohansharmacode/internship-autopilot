import { isInternship } from "../match";
import type { Job } from "../types";

type AshbyJob = {
  id: string;
  title: string;
  location?: string;
  employmentType?: string;
  isRemote?: boolean;
  jobUrl: string;
  applyUrl?: string;
  descriptionPlain?: string;
  publishedAt?: string;
  isListed?: boolean;
};

export function parseAshby(board: string, body: { jobs: AshbyJob[] }, now = new Date().toISOString()): Job[] {
  return body.jobs
    .filter((j) => j.isListed !== false && (isInternship(j.title) || j.employmentType === "Intern"))
    .map((j) => ({
      id: `ashby:${board}:${j.id}`,
      source: "ashby" as const,
      board,
      externalId: j.id,
      company: board.charAt(0).toUpperCase() + board.slice(1),
      title: j.title.trim(),
      location: [j.location, j.isRemote ? "Remote" : ""].filter(Boolean).join(" · "),
      url: j.jobUrl,
      applyUrl: j.applyUrl ?? `${j.jobUrl}/application`,
      description: j.descriptionPlain ?? "",
      postedAt: j.publishedAt ?? now,
      fetchedAt: now,
      via: "board" as const,
    }));
}

export async function fetchAshby(board: string): Promise<Job[]> {
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}`);
  if (!res.ok) throw new Error(`Ashby board "${board}" returned ${res.status}`);
  return parseAshby(board, await res.json());
}
