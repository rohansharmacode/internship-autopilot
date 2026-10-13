import { extractText, getDocumentProxy } from "unpdf";
import { extractSkills } from "./skills";
import type { GithubRepo, Profile } from "./types";

export async function pdfToText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

/** Pulls the obvious contact details out of CV text without any AI. */
export function contactsFromText(text: string): Partial<Profile> {
  const out: Partial<Profile> = {};
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (email) out.email = email[0];
  const phone = text.match(/(\+?\d[\d ()-]{8,}\d)/);
  if (phone) out.phone = phone[1].trim();
  const li = text.match(/(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w-]+\/?/i);
  if (li) out.linkedinUrl = li[0].startsWith("http") ? li[0] : `https://${li[0]}`;
  const gh = text.match(/github\.com\/([\w-]+)/i);
  if (gh) out.githubUsername = gh[1];
  out.skills = extractSkills(text);
  return out;
}

type GhApiRepo = {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  html_url: string;
  fork: boolean;
  pushed_at: string;
};

export async function importGithub(username: string): Promise<{ repos: GithubRepo[]; languages: string[] }> {
  const user = username.replace(/^@/, "").replace(/^https?:\/\/github\.com\//, "").split("/")[0];
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "internship-autopilot" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=pushed`, { headers });
  if (!res.ok) throw new Error(`GitHub returned ${res.status} for ${user}`);
  const all = (await res.json()) as GhApiRepo[];
  const repos = all
    .filter((r) => !r.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count || b.pushed_at.localeCompare(a.pushed_at))
    .slice(0, 12)
    .map((r) => ({
      name: r.name,
      description: r.description ?? "",
      language: r.language ?? "",
      stars: r.stargazers_count,
      url: r.html_url,
    }));
  const counts = new Map<string, number>();
  for (const r of all) if (r.language && !r.fork) counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
  const languages = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
  return { repos, languages };
}
