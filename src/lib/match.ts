import { extractSkills } from "./skills";
import { normalise } from "./text";
import type { Job, Profile } from "./types";

const INTERN_RE = /\b(intern|interns|internship|co-?op|apprentice(ship)?|placement|summer analyst|summer associate|working student)\b/i;
const SENIOR_RE = /\b(senior|staff|principal|lead|manager|director|head of|vp)\b/i;

export function isInternship(title: string, extra = ""): boolean {
  return INTERN_RE.test(title) || /\bintern/i.test(extra);
}

/** Scores a job 0-100 for this profile and says why, so the list can be sorted and explained. */
export function scoreJob(job: Pick<Job, "title" | "description" | "location"> & Partial<Pick<Job, "sponsorship">>, profile: Profile): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const jobSkills = extractSkills(`${job.title}\n${job.description}`);
  const mine = new Set(profile.skills.map((s) => s.toLowerCase()));
  const overlap = jobSkills.filter((s) => mine.has(s.toLowerCase()));
  if (jobSkills.length > 0) {
    const ratio = overlap.length / Math.min(jobSkills.length, 8);
    score += Math.round(Math.min(1, ratio) * 50);
  } else if (job.description.length < 200) {
    // Listings without a description can't be compared on skills yet; don't bury them for it.
    score += 15;
  }
  if (overlap.length) reasons.push(`Skills you have: ${overlap.slice(0, 6).join(", ")}`);

  const title = normalise(job.title);
  const hits = profile.preferences.keywords.filter((k) => k.trim() && title.includes(normalise(k)));
  if (hits.length) {
    score += Math.min(30, 15 * hits.length);
    reasons.push(`Title matches ${hits.join(", ")}`);
  }

  const loc = normalise(job.location);
  const remote = /remote|anywhere/.test(loc);
  const wanted = profile.preferences.locations.filter((l) => l.trim());
  if (remote && profile.preferences.remoteOk) {
    score += 20;
    reasons.push("Remote");
  } else if (wanted.length === 0) {
    score += 10;
  } else {
    const place = wanted.find((l) => loc.includes(normalise(l)));
    if (place) {
      score += 20;
      reasons.push(`In ${place}`);
    } else {
      reasons.push(`Location: ${job.location || "not stated"}`);
    }
  }

  if (profile.answers.needsSponsorship === "yes" && job.sponsorship && /not offer|citizen/i.test(job.sponsorship)) {
    score -= 40;
    reasons.push(job.sponsorship);
  } else if (profile.answers.needsSponsorship === "yes" && job.sponsorship && /offers sponsorship/i.test(job.sponsorship)) {
    score += 10;
    reasons.push("Offers sponsorship");
  }

  if (SENIOR_RE.test(job.title)) {
    score -= 30;
    reasons.push("Title reads as a senior role");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}
