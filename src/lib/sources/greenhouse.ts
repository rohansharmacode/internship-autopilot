import { isInternship } from "../match";
import { htmlToText } from "../text";
import type { Job } from "../types";

type GhJob = {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  content?: string;
  company_name?: string;
  first_published?: string;
  updated_at?: string;
};

export function parseGreenhouse(board: string, body: { jobs: GhJob[] }, now = new Date().toISOString()): Job[] {
  return body.jobs
    .filter((j) => isInternship(j.title))
    .map((j) => {
      // The hosted form lives on job-boards.greenhouse.io even when absolute_url points at the company's own site.
      const applyUrl = `https://job-boards.greenhouse.io/${board}/jobs/${j.id}`;
      return {
        id: `greenhouse:${board}:${j.id}`,
        source: "greenhouse" as const,
        board,
        externalId: String(j.id),
        company: j.company_name ?? board,
        title: j.title.trim(),
        location: j.location?.name ?? "",
        url: j.absolute_url,
        applyUrl,
        description: htmlToText(j.content ?? ""),
        postedAt: j.first_published ?? j.updated_at ?? now,
        fetchedAt: now,
      };
    });
}

export async function fetchGreenhouse(board: string): Promise<Job[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`);
  if (!res.ok) throw new Error(`Greenhouse board "${board}" returned ${res.status}`);
  return parseGreenhouse(board, await res.json());
}
