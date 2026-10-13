import type { FieldType, FormField } from "../types";

type GhField = { name: string; type: string; values: { label: string; value: string | number }[] };
type GhQuestion = { label: string; required: boolean; description?: string | null; fields: GhField[] };

const TYPE: Record<string, FieldType | undefined> = {
  input_text: "text",
  textarea: "textarea",
  input_file: "file",
  multi_value_single_select: "select",
  multi_value_multi_select: "multiselect",
};

export function parseGreenhouseQuestions(body: {
  questions?: GhQuestion[];
  location_questions?: GhQuestion[];
}): FormField[] {
  const questions = [...(body.questions ?? []), ...(body.location_questions ?? [])];
  const fields: FormField[] = [];
  for (const q of questions) {
    // A question can offer several inputs (attach a file, or paste text). The first one is the usual route.
    const f = q.fields.find((x) => TYPE[x.type]);
    if (!f) continue;
    const type = TYPE[f.type]!;
    fields.push({
      key: f.name,
      label: q.label.trim(),
      type,
      required: q.required,
      options: f.values.length ? f.values.map((v) => ({ label: v.label, value: String(v.value) })) : undefined,
      value: "",
      source: "empty",
    });
  }
  // Demographic and EEOC questions are voluntary; the app leaves them for you rather than answering on your behalf.
  return fields;
}

export async function loadGreenhouseForm(board: string, jobId: string): Promise<FormField[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}?questions=true`);
  if (!res.ok) throw new Error(`Could not load the Greenhouse form (${res.status})`);
  return parseGreenhouseQuestions(await res.json());
}
