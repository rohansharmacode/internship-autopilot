"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aiAvailable, profileFromDocuments } from "@/lib/ai";
import { prepareApplication, refreshJobs, rescoreJobs, saveAnswers, sendApplication, setStatus } from "@/lib/applications";
import { contactsFromText, importGithub, pdfToText } from "@/lib/profile-import";
import { mergeSkills } from "@/lib/skills";
import { boardFromUrl } from "@/lib/sources";
import { readDb, saveFile, updateDb } from "@/lib/store";
import type { Profile, Source, YesNo } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const list = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
const yn = (s: string): YesNo => (s === "yes" || s === "no" ? s : "");

function back(path: string, msg: string): never {
  revalidatePath("/", "layout");
  redirect(`${path}?msg=${encodeURIComponent(msg)}`);
}

/** Copies extracted values into the profile without overwriting anything you typed yourself. */
function fillBlanks(profile: Profile, found: Partial<Profile>): void {
  for (const [k, v] of Object.entries(found) as [keyof Profile, unknown][]) {
    if (k === "skills") continue;
    if (typeof v === "string" && v && !profile[k]) (profile as Record<string, unknown>)[k] = v;
  }
  if (found.skills) profile.skills = mergeSkills(profile.skills, found.skills);
}

export async function saveProfile(fd: FormData) {
  await updateDb((db) => {
    const p = db.profile;
    for (const k of ["firstName", "lastName", "email", "phone", "city", "country", "school", "degree", "major", "graduationDate", "gpa", "linkedinUrl", "githubUsername", "portfolioUrl", "summary"] as const) {
      p[k] = str(fd, k);
    }
    p.skills = mergeSkills(list(str(fd, "skills")));
    p.answers = {
      workAuthorized: yn(str(fd, "workAuthorized")),
      needsSponsorship: yn(str(fd, "needsSponsorship")),
      willingToRelocate: yn(str(fd, "willingToRelocate")),
      earliestStart: str(fd, "earliestStart"),
      howDidYouHear: str(fd, "howDidYouHear"),
      pronouns: str(fd, "pronouns"),
    };
    p.preferences = {
      keywords: list(str(fd, "keywords")),
      locations: list(str(fd, "locations")),
      remoteOk: fd.get("remoteOk") === "on",
      minScore: Number(str(fd, "minScore")) || 0,
    };
  });
  await rescoreJobs();
  back("/profile", "Profile saved.");
}

async function readUpload(fd: FormData, key: string): Promise<{ name: string; data: Buffer } | null> {
  const file = fd.get(key);
  if (!(file instanceof File) || file.size === 0) return null;
  return { name: file.name, data: Buffer.from(await file.arrayBuffer()) };
}

async function documentText(name: string, data: Buffer): Promise<string> {
  if (/\.pdf$/i.test(name)) return pdfToText(new Uint8Array(data));
  if (/\.(txt|md)$/i.test(name)) return data.toString("utf8");
  throw new Error("Upload a PDF or a .txt file.");
}

export async function uploadCv(fd: FormData) {
  const up = await readUpload(fd, "cv");
  if (!up) back("/profile", "Choose a file first.");
  let text: string;
  try {
    text = await documentText(up.name, up.data);
  } catch (err) {
    back("/profile", (err as Error).message);
  }
  const storedPath = await saveFile(`cv-${up.name}`, up.data);
  const extracted = aiAvailable() ? await profileFromDocuments(text).catch(() => null) : null;
  await updateDb((db) => {
    db.profile.cv = { fileName: up.name, storedPath, text, uploadedAt: new Date().toISOString() };
    fillBlanks(db.profile, contactsFromText(text));
    if (extracted) fillBlanks(db.profile, extracted);
  });
  await rescoreJobs();
  back("/profile", extracted ? "CV uploaded. Claude filled in the blanks it could; check them below." : "CV uploaded and contact details filled in.");
}

export async function uploadLinkedin(fd: FormData) {
  const up = await readUpload(fd, "linkedin");
  if (!up) back("/profile", "Choose a file first.");
  let text: string;
  try {
    text = await documentText(up.name, up.data);
  } catch (err) {
    back("/profile", (err as Error).message);
  }
  const db0 = await readDb();
  const extracted = aiAvailable() ? await profileFromDocuments(db0.profile.cv?.text ?? "", text).catch(() => null) : null;
  await updateDb((db) => {
    db.profile.linkedinText = text;
    fillBlanks(db.profile, contactsFromText(text));
    if (extracted) fillBlanks(db.profile, extracted);
  });
  await rescoreJobs();
  back("/profile", "LinkedIn profile added.");
}

export async function importGithubAction(fd: FormData) {
  const db0 = await readDb();
  const username = str(fd, "githubUsername") || db0.profile.githubUsername;
  if (!username) back("/profile", "Enter your GitHub username first.");
  try {
    const gh = await importGithub(username);
    await updateDb((db) => {
      db.profile.githubUsername = username.replace(/^@/, "");
      db.profile.github = { ...gh, importedAt: new Date().toISOString() };
      db.profile.skills = mergeSkills(db.profile.skills, gh.languages);
    });
  } catch (err) {
    back("/profile", `GitHub import failed: ${(err as Error).message}`);
  }
  await rescoreJobs();
  back("/profile", "GitHub projects imported.");
}

export async function refreshJobsAction() {
  const r = await refreshJobs();
  const errs = r.errors.length ? ` ${r.errors.length} board(s) failed: ${r.errors.join("; ")}` : "";
  back("/jobs", `Found ${r.added} new internship${r.added === 1 ? "" : "s"} (${r.total} listed).${errs}`);
}

export async function hideJob(fd: FormData) {
  const id = str(fd, "jobId");
  await updateDb((db) => {
    const j = db.jobs.find((x) => x.id === id);
    if (j) j.hidden = !j.hidden;
  });
  revalidatePath("/jobs");
}

export async function prepareAction(fd: FormData) {
  let id: string;
  try {
    id = (await prepareApplication(str(fd, "jobId"))).id;
  } catch (err) {
    back("/jobs", (err as Error).message);
  }
  revalidatePath("/", "layout");
  redirect(`/applications/${id}`);
}

function answersFrom(fd: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("f:")) continue;
    const key = k.slice(2);
    values[key] = key in values ? `${values[key]}\n${String(v)}` : String(v);
  }
  return values;
}

export async function saveApplication(fd: FormData) {
  const id = str(fd, "id");
  await saveAnswers(id, answersFrom(fd), str(fd, "coverLetter"));
  const intent = str(fd, "intent");
  if (intent === "send") {
    const problem = await sendApplication(id);
    const { settings } = await readDb();
    const started = settings.rehearsal ? "Rehearsing: the browser is filling in the form but will not submit it." : "Approved. The browser is filling in the form now.";
    back(`/applications/${id}`, problem ?? started);
  }
  if (intent === "skip") {
    await setStatus(id, "skipped");
    back("/applications", "Skipped.");
  }
  if (intent === "reopen") {
    await setStatus(id, "draft");
  }
  back(`/applications/${id}`, "Saved.");
}

export async function markSubmitted(fd: FormData) {
  const id = str(fd, "id");
  await updateDb((db) => {
    const a = db.applications.find((x) => x.id === id);
    if (a) {
      a.status = "submitted";
      a.submittedAt = new Date().toISOString();
      a.log.push("You marked this as submitted.");
    }
  });
  back(`/applications/${id}`, "Marked as submitted.");
}

export async function saveSettings(fd: FormData) {
  await updateDb((db) => {
    db.settings.rehearsal = fd.get("rehearsal") === "on";
    db.settings.showBrowser = fd.get("showBrowser") === "on";
    db.settings.dailyLimit = Math.max(1, Number(str(fd, "dailyLimit")) || 15);
  });
  back("/settings", "Settings saved.");
}

export async function addBoard(fd: FormData) {
  const raw = str(fd, "board");
  const board = boardFromUrl(raw) ?? (raw && /^[\w.-]+$/.test(raw) ? { source: str(fd, "source") as Source, token: raw } : null);
  if (!board || !["greenhouse", "lever", "ashby"].includes(board.source)) back("/settings", "Paste a Greenhouse, Lever or Ashby jobs link.");
  await updateDb((db) => {
    if (!db.settings.boards.some((b) => b.source === board.source && b.token === board.token)) db.settings.boards.push(board);
  });
  back("/settings", `Added ${board.token} (${board.source}).`);
}

export async function removeBoard(fd: FormData) {
  const [source, token] = str(fd, "board").split("/");
  await updateDb((db) => {
    db.settings.boards = db.settings.boards.filter((b) => !(b.source === source && b.token === token));
  });
  back("/settings", `Removed ${token}.`);
}
