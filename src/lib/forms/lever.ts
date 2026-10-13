import { decodeEntities } from "../text";
import type { FieldType, FormField } from "../types";

const STANDARD: FormField[] = [
  { key: "resume", label: "Resume/CV", type: "file", required: true, value: "", source: "empty" },
  { key: "name", label: "Full name", type: "text", required: true, value: "", source: "empty" },
  { key: "email", label: "Email", type: "text", required: true, value: "", source: "empty" },
  { key: "phone", label: "Phone", type: "text", required: false, value: "", source: "empty" },
  { key: "location", label: "Current location", type: "text", required: false, value: "", source: "empty" },
  { key: "org", label: "Current company", type: "text", required: false, value: "", source: "empty" },
  { key: "urls[LinkedIn]", label: "LinkedIn URL", type: "text", required: false, value: "", source: "empty" },
  { key: "urls[GitHub]", label: "GitHub URL", type: "text", required: false, value: "", source: "empty" },
  { key: "urls[Portfolio]", label: "Portfolio URL", type: "text", required: false, value: "", source: "empty" },
  { key: "comments", label: "Additional information", type: "textarea", required: false, value: "", source: "empty" },
];

type CardField = {
  type: string;
  text: string;
  required?: boolean;
  options?: { text: string }[];
};

const CARD_TYPE: Record<string, FieldType | undefined> = {
  text: "text",
  textarea: "textarea",
  dropdown: "select",
  "multiple-choice": "select",
  "multiple-select": "multiselect",
};

/** Lever has no public API for an application form, but the apply page embeds each custom card as JSON. */
export function parseLeverApplyPage(html: string): FormField[] {
  const present = new Set([...html.matchAll(/name="([^"]+)"/g)].map((m) => decodeEntities(m[1])));
  const fields = STANDARD.filter((f) => present.has(f.key) || f.key === "resume" || f.key === "name" || f.key === "email").map((f) => {
    const required = new RegExp(`name="${f.key.replace(/[[\]]/g, "\\$&")}"[^>]*required`).test(html);
    return { ...f, required: f.required || required };
  });

  for (const m of html.matchAll(/value="([^"]+)"\s+name="cards\[([\w-]+)\]\[baseTemplate\]"/g)) {
    let card: { fields?: CardField[] };
    try {
      card = JSON.parse(decodeEntities(m[1]));
    } catch {
      continue;
    }
    (card.fields ?? []).forEach((cf, i) => {
      const type = CARD_TYPE[cf.type];
      if (!type) return;
      fields.push({
        key: `cards[${m[2]}][field${i}]`,
        label: cf.text,
        type,
        required: Boolean(cf.required),
        options: cf.options?.map((o) => ({ label: o.text, value: o.text })),
        value: "",
        source: "empty",
      });
    });
  }
  return fields;
}

export async function loadLeverForm(applyUrl: string): Promise<FormField[]> {
  const res = await fetch(applyUrl);
  if (!res.ok) throw new Error(`Could not load the Lever form (${res.status})`);
  return parseLeverApplyPage(await res.text());
}
