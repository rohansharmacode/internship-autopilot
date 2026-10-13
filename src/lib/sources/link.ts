import { decodeEntities } from "../text";
import type { Job } from "../types";
import { parseAshby } from "./ashby";
import { parsePostingUrl } from "./community";
import { parseGreenhouse } from "./greenhouse";
import { parseLever } from "./lever";

/** Sites that list other companies' jobs. Their own page is not the application, so we ask for the employer's link. */
const AGGREGATORS = /(^|\.)(the-trackr\.com|linkedin\.com|indeed\.[a-z.]+|glassdoor\.[a-z.]+|joinhandshake\.com|simplify\.jobs)$/i;

export class LinkError extends Error {}

function pageMeta(html: string, prop: string): string {
  const m =
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i")) ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i"));
  return m ? decodeEntities(m[1]).trim() : "";
}

/**
 * Turns one internship link you paste in (for example the Apply link from a tracker site) into a job.
 * Greenhouse, Lever and Ashby postings become jobs the app can fill in; anything else is tracked and you apply on the site.
 */
export async function jobFromLink(raw: string, now = new Date().toISOString()): Promise<Job> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new LinkError("That doesn't look like a link. Copy the whole address, starting with https://");
  }
  if (AGGREGATORS.test(url.hostname)) {
    throw new LinkError(
      "That's a link to a listings site, not the employer. Open the posting there, press its Apply button, and paste the address of the page that opens.",
    );
  }

  const parsed = parsePostingUrl(url.toString());
  const asLink = (j: Job): Job => ({ ...j, via: "link" });
  if (parsed?.source === "greenhouse") {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${parsed.board}/jobs/${parsed.externalId}?content=true`);
    if (res.status === 404) throw new LinkError("That Greenhouse posting has closed.");
    if (!res.ok) throw new LinkError(`Greenhouse returned ${res.status} for that posting.`);
    const body = await res.json();
    // The parsers skip non-internships; a posting you picked yourself is kept whatever its title says.
    const [job] = parseGreenhouse(parsed.board, { jobs: [{ ...body, title: "Intern" }] }, now);
    return asLink({ ...job, title: body.title.trim() });
  }
  if (parsed?.source === "lever") {
    const res = await fetch(`https://api.lever.co/v0/postings/${parsed.board}/${parsed.externalId}?mode=json`);
    if (res.status === 404) throw new LinkError("That Lever posting has closed.");
    if (!res.ok) throw new LinkError(`Lever returned ${res.status} for that posting.`);
    const body = await res.json();
    const [job] = parseLever(parsed.board, [{ ...body, categories: { ...body.categories, commitment: "Intern" } }], now);
    return asLink({ ...job, title: body.text.trim() });
  }
  if (parsed?.source === "ashby") {
    const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(parsed.board)}`);
    if (!res.ok) throw new LinkError(`Ashby returned ${res.status} for that company.`);
    const body = await res.json();
    const posting = (body.jobs ?? []).find((j: { id: string }) => j.id === parsed.externalId);
    if (!posting) throw new LinkError("That Ashby posting has closed.");
    const [job] = parseAshby(parsed.board, { jobs: [{ ...posting, isListed: true, employmentType: "Intern" }] }, now);
    return asLink({ ...job, title: posting.title.trim() });
  }

  // Any other site (Workday, a company's own careers page): track it, and you apply there yourself.
  let title = "";
  let company = "";
  let description = "";
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (InternshipAutopilot)" }, signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const html = await res.text();
      title = pageMeta(html, "og:title") || decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();
      company = pageMeta(html, "og:site_name");
      description = pageMeta(html, "og:description") || pageMeta(html, "description");
    }
  } catch {
    // Some careers sites block simple requests; the link is still worth tracking.
  }
  const host = url.hostname.replace(/^www\./, "");
  return {
    id: `external:${url.toString()}`,
    source: "external",
    board: host,
    externalId: url.toString(),
    company: company || host.split(".")[0].replace(/^\w/, (c) => c.toUpperCase()),
    title: title || "Internship",
    location: "",
    url: url.toString(),
    applyUrl: url.toString(),
    description,
    postedAt: now,
    fetchedAt: now,
    via: "link",
  };
}
