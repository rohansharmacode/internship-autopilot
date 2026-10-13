import { normalise } from "./text";
import type { FieldOption, FormField, Profile, YesNo } from "./types";

type Answer = { value: string; note?: string };
type Rule = { test: RegExp; get: (p: Profile, field: FormField) => Answer | string | null };

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function gradParts(date: string): { year: string; month: string } {
  const year = date.match(/\b(19|20)\d{2}\b/)?.[0] ?? "";
  const lower = date.toLowerCase();
  let month = MONTHS.find((m) => lower.includes(m.slice(0, 3))) ?? "";
  const iso = date.match(/\b\d{4}-(\d{2})/);
  if (!month && iso) month = MONTHS[Number(iso[1]) - 1] ?? "";
  return { year, month: month ? month[0].toUpperCase() + month.slice(1) : "" };
}

const yn = (v: YesNo) => (v ? (v === "yes" ? "Yes" : "No") : null);
const githubUrl = (p: Profile) => (p.githubUsername ? `https://github.com/${p.githubUsername.replace(/^@/, "")}` : "");
const fullName = (p: Profile) => [p.firstName, p.lastName].filter(Boolean).join(" ");

// Order matters: the first rule whose pattern matches the label (or the field key) wins.
const RULES: Rule[] = [
  { test: /\b(resume|cv)\b/, get: (p, f) => (f.type === "file" ? (p.cv ? "resume" : null) : p.cv?.text ?? null) },
  { test: /cover letter/, get: (_p, f) => (f.type === "file" ? "cover_letter" : null) },
  { test: /preferred (first )?name|what would you like us to call you/, get: (p) => p.firstName },
  { test: /first name|first_name|given name/, get: (p) => p.firstName },
  { test: /last name|last_name|surname|family name/, get: (p) => p.lastName },
  { test: /pronunciation/, get: () => null },
  { test: /^(full |legal )?name\b|systemfield_name|^your name/, get: fullName },
  { test: /e-?mail/, get: (p) => p.email },
  { test: /phone|mobile/, get: (p) => p.phone },
  { test: /linkedin/, get: (p) => p.linkedinUrl },
  { test: /github/, get: githubUrl },
  { test: /website|portfolio|personal site|other url/, get: (p) => p.portfolioUrl || githubUrl(p) },
  { test: /pronoun/, get: (p) => p.answers.pronouns || null },
  { test: /sponsor/, get: (p) => yn(p.answers.needsSponsorship) },
  { test: /authori[sz]ed to work|legally (authori[sz]ed|eligible)|right to work|eligible to work|work authori[sz]ation/, get: (p) => yn(p.answers.workAuthorized) },
  { test: /relocat/, get: (p) => yn(p.answers.willingToRelocate) },
  { test: /start date|earliest.*start|when can you start|available to start|availability/, get: (p) => p.answers.earliestStart },
  { test: /how (did )?you (hear|heard|find|found|connect|learn|learned)|where did you (hear|find)|referral source|^source$/, get: (p) => p.answers.howDidYouHear },
  {
    test: /(worked|employed) (for|at|with) .* before|previously (worked|been employed)|former employee|ever worked for/,
    get: () => ({ value: "No", note: "Assumed you have not worked there before. Change it if you have." }),
  },
  { test: /graduat.*year|year of graduation|class of/, get: (p) => gradParts(p.graduationDate).year },
  { test: /graduat.*month/, get: (p) => gradParts(p.graduationDate).month },
  { test: /graduat|completion date|expected to finish/, get: (p) => p.graduationDate },
  { test: /\bgpa\b|grade point/, get: (p) => p.gpa },
  { test: /university|school|college|institution|attending/, get: (p) => p.school },
  { test: /degree/, get: (p) => p.degree },
  { test: /major|discipline|field of study|area of study|concentration/, get: (p) => p.major },
  { test: /current (company|employer|organi[sz]ation)|^org$/, get: (p) => p.school },
  { test: /^location|city|where are you (currently )?(based|located)|current location|^location$/, get: (p) => [p.city, p.country].filter(Boolean).join(", ") },
  { test: /country/, get: (p) => p.country },
];

/** Picks the option that best matches what the profile says, or null when none is a confident match. */
export function chooseOption(options: FieldOption[], wanted: string): FieldOption | null {
  const w = normalise(wanted);
  if (!w) return null;
  const by = (pred: (o: string) => boolean) => options.find((o) => pred(normalise(o.label)));
  return (
    by((o) => o === w) ??
    (w === "yes" || w === "no" ? by((o) => o.startsWith(`${w} `) || o.startsWith(w)) : undefined) ??
    by((o) => o.startsWith(w)) ??
    by((o) => w.length > 3 && o.includes(w)) ??
    by((o) => o.length > 3 && w.includes(o)) ??
    null
  );
}

const HEARD_FALLBACKS = ["company website", "careers page", "career site", "website", "job board", "online", "other"];

export function answerFor(field: FormField, profile: Profile): Answer | null {
  const label = normalise(field.label);
  const key = field.key.toLowerCase();
  for (const rule of RULES) {
    if (!rule.test.test(label) && !rule.test.test(key)) continue;
    const raw = rule.get(profile, field);
    const ans = typeof raw === "string" ? { value: raw } : raw;
    if (!ans || !ans.value) return null;
    if (field.type === "select" || field.type === "multiselect") {
      if (!field.options?.length) return ans;
      let opt = chooseOption(field.options, ans.value);
      if (!opt && /graduat/.test(label)) {
        const { year, month } = gradParts(ans.value);
        const m = MONTHS.indexOf(month.toLowerCase());
        const season = m < 0 ? "" : m <= 5 ? "Spring" : m <= 7 ? "Summer" : "Fall";
        for (const alt of [season && `${season} ${year}`, m >= 0 && m <= 5 && `Winter ${year}`, year]) {
          if (alt && (opt = chooseOption(field.options, alt))) break;
        }
      }
      if (!opt && /how (did )?you/.test(label)) {
        for (const f of HEARD_FALLBACKS) if ((opt = chooseOption(field.options, f))) break;
      }
      return opt ? { value: opt.label, note: ans.note } : null;
    }
    return ans;
  }
  return null;
}

/** Fills every field the profile can answer. Fields it cannot answer stay empty for the AI draft or for you. */
export function autoFill(fields: FormField[], profile: Profile): FormField[] {
  return fields.map((f) => {
    if (f.source === "you") return f;
    const a = answerFor(f, profile);
    return a ? { ...f, value: a.value, source: "profile", note: a.note } : { ...f, value: "", source: "empty" };
  });
}

export function missingRequired(fields: FormField[]): FormField[] {
  return fields.filter((f) => f.required && !f.value.trim());
}
