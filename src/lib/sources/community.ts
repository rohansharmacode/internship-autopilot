import { isInternship } from "../match";
import type { Job, JobSource } from "../types";

/** The SimplifyJobs community list: thousands of internships, updated daily on GitHub. */
export const COMMUNITY_LIST_URL =
  "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json";

type Listing = {
  id: string;
  company_name: string;
  title: string;
  url: string;
  locations?: string[];
  active?: boolean;
  is_visible?: boolean;
  date_posted?: number;
  category?: string;
  sponsorship?: string;
  terms?: string[];
};

export type ParsedUrl = { source: JobSource; board: string; externalId: string; applyUrl: string };

/** Works out which job board a posting link belongs to, so the app can load its application form. */
export function parsePostingUrl(raw: string): ParsedUrl | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (/(^|\.)greenhouse\.io$/.test(host)) {
    const embedBoard = url.searchParams.get("for");
    const embedId = url.searchParams.get("token") ?? url.searchParams.get("gh_jid");
    if (embedBoard && embedId) return gh(embedBoard, embedId);
    const i = parts.indexOf("jobs");
    if (i === 1 && /^\d+$/.test(parts[2] ?? "")) return gh(parts[0], parts[2]);
  }
  if (host === "jobs.lever.co" && parts.length >= 2 && /^[0-9a-f-]{36}$/i.test(parts[1])) {
    return {
      source: "lever",
      board: parts[0].toLowerCase(),
      externalId: parts[1],
      applyUrl: `https://jobs.lever.co/${parts[0]}/${parts[1]}/apply`,
    };
  }
  if (host === "jobs.ashbyhq.com" && parts.length >= 2 && /^[0-9a-f-]{36}$/i.test(parts[1])) {
    return {
      source: "ashby",
      board: parts[0],
      externalId: parts[1],
      applyUrl: `https://jobs.ashbyhq.com/${parts[0]}/${parts[1]}/application`,
    };
  }
  return null;
}

function gh(board: string, id: string): ParsedUrl {
  return {
    source: "greenhouse",
    board: board.toLowerCase(),
    externalId: id,
    applyUrl: `https://job-boards.greenhouse.io/${board.toLowerCase()}/jobs/${id}`,
  };
}

const MAX_AGE_DAYS = 120;

export function parseCommunityList(listings: Listing[], nowMs = Date.now()): Job[] {
  const now = new Date(nowMs).toISOString();
  const oldest = nowMs / 1000 - MAX_AGE_DAYS * 86400;
  const jobs: Job[] = [];
  for (const l of listings) {
    if (!l.active || l.is_visible === false || !l.url) continue;
    if ((l.date_posted ?? 0) < oldest) continue;
    if (!isInternship(l.title, "intern")) continue;
    const parsed = parsePostingUrl(l.url);
    const source: JobSource = parsed?.source ?? "external";
    const externalId = parsed?.externalId ?? l.id;
    const board = parsed?.board ?? new URL(l.url).hostname;
    jobs.push({
      id: parsed ? `${source}:${board}:${externalId}` : `external:${l.id}`,
      source,
      board,
      externalId,
      company: l.company_name,
      title: l.title.trim(),
      location: (l.locations ?? []).join(" · "),
      url: l.url,
      applyUrl: parsed?.applyUrl ?? l.url,
      description: [l.category && `Category: ${l.category}`, l.terms?.length && `Terms: ${l.terms.join(", ")}`].filter(Boolean).join("\n"),
      postedAt: l.date_posted ? new Date(l.date_posted * 1000).toISOString() : now,
      fetchedAt: now,
      sponsorship: l.sponsorship && l.sponsorship !== "Other" ? l.sponsorship : undefined,
      via: "community",
    });
  }
  return jobs;
}

export async function fetchCommunityList(): Promise<Job[]> {
  const res = await fetch(COMMUNITY_LIST_URL);
  if (!res.ok) throw new Error(`The community list returned ${res.status}`);
  return parseCommunityList(await res.json());
}
