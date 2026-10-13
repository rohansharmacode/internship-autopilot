import { normalise } from "./text";
import type { FormField } from "./types";

export type DraftAnswer = { key: string; value: string; note: string };

/**
 * Puts Claude's answers into the empty fields. A choice answer must be one of the form's own options
 * (matched ignoring case and punctuation); anything else is dropped so you never send an invalid choice.
 * Fields already answered from your profile or by you are never overwritten.
 */
export function applyDraft(fields: FormField[], answers: DraftAnswer[]): FormField[] {
  const byKey = new Map(answers.map((a) => [a.key, a]));
  return fields.map((f) => {
    const a = byKey.get(f.key);
    if (!a || f.source !== "empty") return f;
    const note = a.note.trim() || undefined;
    let value = a.value.trim();
    if (f.options?.length) {
      const picks = (f.type === "multiselect" ? value.split("\n") : [value])
        .map((v) => f.options!.find((o) => normalise(o.label) === normalise(v))?.label)
        .filter((v): v is string => Boolean(v));
      const expected = f.type === "multiselect" ? value.split("\n").filter((v) => v.trim()).length : 1;
      value = picks.length === expected ? [...new Set(picks)].join("\n") : "";
    }
    return value ? { ...f, value, source: "ai", note } : { ...f, note };
  });
}
