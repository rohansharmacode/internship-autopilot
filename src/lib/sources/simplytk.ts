import { decodeEntities } from "../text";
import type { Job, JobSource } from "../types";
import { parsePostingUrl } from "./community";

/** simplytk.com's live tracker of UK internships, spring weeks and placements. */
export const SIMPLYTK_TRACKER_URL = "https://simplytk.com/internship-tracker";

/** Graduate jobs are listed too; the app is for internships, so they're left out. */
const SKIP_PROGRAMMES = /^graduate/i;

const cellText = (html: string) =>
  decodeEntities(html.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "|"))
    .split("|")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

/** Turns "5 hours ago" into a date. Unknown wording counts as now. */
export function parseAgo(text: string, nowMs = Date.now()): string {
  const m = text.match(/(\d+)\s*(minute|min|hour|day|week|month|year)s?\s+ago/i);
  const unit: Record<string, number> = { minute: 60e3, min: 60e3, hour: 3600e3, day: 86400e3, week: 7 * 86400e3, month: 30 * 86400e3, year: 365 * 86400e3 };
  let ms = 0;
  if (m) ms = Number(m[1]) * unit[m[2].toLowerCase()];
  else if (/yesterday/i.test(text)) ms = 86400e3;
  return new Date(nowMs - ms).toISOString();
}

/** Reads one page of the tracker table. */
export function parseSimplytkPage(html: string, nowMs = Date.now()): Job[] {
  const now = new Date(nowMs).toISOString();
  const jobs: Job[] = [];
  for (const [, row] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (cells.length < 7) continue;
    const apply = cells[6].match(/href="(https?:\/\/[^"]+)"/)?.[1];
    const opening = cells[1].match(/href="\/openings\/([^"]+)"/)?.[1];
    if (!apply || !opening) continue;
    const [company, sector] = cellText(cells[0]);
    const [title, ...roleBits] = cellText(cells[1]).filter((s) => s !== "NEW");
    const programme = cellText(cells[2])[0] ?? "";
    if (!company || !title || SKIP_PROGRAMMES.test(programme)) continue;
    const location = cellText(cells[3]).join(" · ");
    const deadline = cellText(cells[4]).join(" ").replace(/^·$/, "");
    const posted = cellText(cells[5])[0] ?? "";

    const url = decodeEntities(apply);
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      continue; // A malformed apply link: nothing the app could open.
    }
    const parsed = parsePostingUrl(url);
    const source: JobSource = parsed?.source ?? "external";
    jobs.push({
      id: parsed ? `${parsed.source}:${parsed.board}:${parsed.externalId}` : `external:simplytk:${opening}`,
      source,
      board: parsed?.board ?? host,
      externalId: parsed?.externalId ?? opening,
      company,
      title,
      location,
      url,
      applyUrl: parsed?.applyUrl ?? url,
      description: [
        `Programme: ${programme}`,
        sector && `Sector: ${sector}`,
        roleBits.length && roleBits.join(" · "),
        deadline && `Deadline: ${deadline}`,
      ].filter(Boolean).join("\n"),
      postedAt: parseAgo(posted, nowMs),
      fetchedAt: now,
      via: "tracker",
    });
  }
  return jobs;
}

/** Reads every page of the tracker, a few at a time. Stops at the first empty page; a page that fails twice is skipped. */
export async function fetchSimplytk(maxPages = 120): Promise<Job[]> {
  const load = async (page: number) => {
    const res = await fetch(`${SIMPLYTK_TRACKER_URL}${page > 1 ? `?page=${page}` : ""}`, {
      headers: { "user-agent": "InternshipAutopilot/1.0 (personal job search)" },
    });
    if (!res.ok) throw new Error(`page ${page} returned ${res.status}`);
    const html = await res.text();
    // Graduate rows are dropped, so a page can yield no jobs and still not be the last one.
    return { jobs: parseSimplytkPage(html), rows: (html.match(/href="\/openings\//g) ?? []).length };
  };
  // One retry, so a single slow page doesn't end the search early.
  const get = (page: number) => load(page).catch(() => load(page));
  const first = await get(1);
  if (first.rows === 0) throw new Error("the tracker page had no openings; its layout may have changed");
  const all = [...first.jobs];
  const BATCH = 4;
  for (let page = 2; page <= maxPages; page += BATCH) {
    const pages = await Promise.all(Array.from({ length: BATCH }, (_, i) => get(page + i).catch(() => ({ jobs: [] as Job[], rows: -1 }))));
    for (const p of pages) all.push(...p.jobs);
    if (pages.some((p) => p.rows === 0)) break;
  }
  const seen = new Set<string>();
  return all.filter((j) => (seen.has(j.id) ? false : (seen.add(j.id), true)));
}
