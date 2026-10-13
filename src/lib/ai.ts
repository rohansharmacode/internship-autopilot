import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { FormField, Job, Profile } from "./types";

const MODEL = process.env.AUTOPILOT_MODEL ?? "claude-opus-5-5";

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function profileBrief(p: Profile): string {
  const lines = [
    `Name: ${p.firstName} ${p.lastName}`,
    `Education: ${[p.degree, p.major, p.school].filter(Boolean).join(", ")}${p.graduationDate ? `, graduating ${p.graduationDate}` : ""}${p.gpa ? `, GPA ${p.gpa}` : ""}`,
    `Location: ${[p.city, p.country].filter(Boolean).join(", ")}`,
    `Skills: ${p.skills.join(", ")}`,
    p.languages?.length && `Languages spoken: ${p.languages.join(", ")}`,
    `Work authorised where applying: ${p.answers.workAuthorized || "not stated"}; needs sponsorship: ${p.answers.needsSponsorship || "not stated"}; earliest start: ${p.answers.earliestStart || "not stated"}`,
    p.summary && `About: ${p.summary}`,
    p.github?.repos.length &&
      `GitHub projects:\n${p.github.repos.map((r) => `- ${r.name} (${r.language || "n/a"}, ${r.stars}★): ${r.description}`).join("\n")}`,
    p.savedAnswers?.length &&
      `Answers the student wrote for earlier applications (match their voice; reuse facts from them):\n${p.savedAnswers
        .slice(-8)
        .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
        .join("\n\n")}`,
    p.cv?.text && `CV:\n${p.cv.text.slice(0, 12000)}`,
    p.linkedinText && `LinkedIn profile:\n${p.linkedinText.slice(0, 8000)}`,
  ];
  return lines.filter(Boolean).join("\n\n");
}

const SYSTEM = `You help a student fill in internship applications. You write in the student's own voice: plain, specific and warm, with no clichés and no exaggeration.
Use only facts that appear in the student's profile. Never invent experience, grades, dates, employers, awards or skills.
If a question cannot be answered truthfully from the profile, return an empty string for it and explain why in "note"; the student will answer it themselves.`;

const DraftSchema = z.object({
  coverLetter: z.string(),
  answers: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
      note: z.string(),
    }),
  ),
});

export type Draft = z.infer<typeof DraftSchema>;

/** Drafts a cover letter and answers for the questions the profile alone could not fill. */
export async function draftApplication(profile: Profile, job: Job, open: FormField[]): Promise<Draft> {
  const client = new Anthropic();
  const questions = open.map((f) => ({
    key: f.key,
    question: f.label,
    required: f.required,
    kind: f.type,
    choices: f.options?.map((o) => o.label),
  }));
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(DraftSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `<profile>\n${profileBrief(profile)}\n</profile>

<job company="${job.company}" title="${job.title}" location="${job.location}">
${job.description.slice(0, 15000)}
</job>

<questions>
${JSON.stringify(questions, null, 1)}
</questions>

Write a cover letter of at most 250 words for this role, then answer every question by its key.
For a question with choices, the value must be exactly one of the choices (several, one per line, when kind is "multiselect").
Keep free-text answers under 150 words unless the question asks for more.`,
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    return { coverLetter: "", answers: [] };
  }
  return response.parsed_output;
}

const ProfileSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  city: z.string(),
  country: z.string(),
  school: z.string(),
  degree: z.string(),
  major: z.string(),
  graduationDate: z.string(),
  gpa: z.string(),
  linkedinUrl: z.string(),
  githubUsername: z.string(),
  portfolioUrl: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
});

/** Reads a CV (and optionally a LinkedIn profile export) into profile fields. Empty strings mean "not stated". */
export async function profileFromDocuments(cvText: string, linkedinText = ""): Promise<z.infer<typeof ProfileSchema> | null> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(ProfileSchema) },
    messages: [
      {
        role: "user",
        content: `Extract the candidate's details from these documents. Use an empty string for anything not stated; do not guess.
graduationDate is the expected or actual graduation month and year as written (for example "May 2027").
summary is two sentences in the first person describing what they study and build.
skills lists technologies, languages and tools they have used.

<cv>
${cvText.slice(0, 30000)}
</cv>
${linkedinText ? `<linkedin>\n${linkedinText.slice(0, 20000)}\n</linkedin>` : ""}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") return null;
  return response.parsed_output ?? null;
}

/** Used when no API key is set, so the app still produces a sensible starting letter. */
export function templateCoverLetter(profile: Profile, job: Job): string {
  const study = [profile.degree, profile.major].filter(Boolean).join(" in ");
  const top = profile.skills.slice(0, 4).join(", ");
  const project = profile.github?.repos[0];
  return [
    `Dear ${job.company} hiring team,`,
    "",
    `I'm ${profile.firstName}${study ? `, a ${study} student` : ""}${profile.school ? ` at ${profile.school}` : ""}, and I'd like to apply for the ${job.title} role.`,
    top ? `I've been working mostly with ${top}${project ? `, most recently on ${project.name}${project.description ? ` (${project.description})` : ""}` : ""}.` : "",
    `I'd love to bring that to ${job.company} and learn from the team.`,
    "",
    "Thank you for your time,",
    `${profile.firstName} ${profile.lastName}`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
}
