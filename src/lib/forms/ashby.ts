import { chromium } from "playwright";
import type { FormField } from "../types";
import { PostingClosedError } from "./closed";

/** The fields every Ashby form has, used if the live form can't be read. */
export function ashbyStandardForm(): FormField[] {
  const f = (key: string, label: string, type: FormField["type"], required: boolean): FormField => ({
    key,
    label,
    type,
    required,
    value: "",
    source: "empty",
  });
  return [
    f("_systemfield_name", "Name", "text", true),
    f("_systemfield_email", "Email", "text", true),
    f("_systemfield_resume", "Resume", "file", true),
  ];
}

type Scraped = {
  key: string;
  label: string;
  required: boolean;
  kind: "file" | "textarea" | "text" | "yesno" | "radio" | "checkboxes" | "combobox";
  options: string[];
};

/** Ashby draws its form in the browser, so the app opens the page and reads each question from it. */
export async function scrapeAshbyForm(applyUrl: string): Promise<FormField[]> {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage();
    await page.goto(applyUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    const form = page.locator(".ashby-application-form-field-entry").first();
    const gone = page.getByText("The job you requested was not found");
    await form.or(gone).first().waitFor({ timeout: 20000 });
    if (await gone.count()) throw new PostingClosedError();
    const scraped: Scraped[] = await page.evaluate(() =>
      [...document.querySelectorAll(".ashby-application-form-field-entry, fieldset")].flatMap((entry) => {
        const label = entry.querySelector("label, legend") as HTMLLabelElement | null;
        if (!label) return [];
        const key = label.htmlFor || label.getAttribute("for") || "";
        const text = (label.textContent ?? "").replace(/\s+/g, " ").trim();
        const required = /\*$/.test(text) || Boolean(entry.querySelector('[class*="required" i]'));
        const optionLabels = (type: string) =>
          [...entry.querySelectorAll(`input[type=${type}]`)].map(
            (i) => (entry.querySelector(`label[for="${CSS.escape(i.id)}"]`)?.textContent ?? i.getAttribute("name") ?? "").trim(),
          );
        const buttons = [...entry.querySelectorAll("button")].map((b) => (b.textContent ?? "").trim());
        let kind: Scraped["kind"];
        let options: string[] = [];
        if (entry.querySelector("input[type=file]")) kind = "file";
        else if (entry.querySelector("textarea")) kind = "textarea";
        else if (buttons.includes("Yes") && buttons.includes("No")) (kind = "yesno"), (options = ["Yes", "No"]);
        else if (entry.querySelector("input[type=radio]")) (kind = "radio"), (options = optionLabels("radio"));
        else if (entry.querySelector("input[type=checkbox]")) (kind = "checkboxes"), (options = optionLabels("checkbox"));
        else if (entry.querySelector("[role=combobox]")) kind = "combobox";
        else if (entry.querySelector("input")) kind = "text";
        else return [];
        return [{ key, label: text.replace(/\s*\*$/, ""), required, kind, options }];
      }),
    );
    const seen = new Set<string>();
    return scraped
      .filter((s) => s.key && !s.key.startsWith("_systemfield_eeoc") && !seen.has(s.key) && seen.add(s.key))
      .map((s): FormField => {
        const type: FormField["type"] =
          s.kind === "file" ? "file" : s.kind === "textarea" ? "textarea" : s.kind === "checkboxes" ? "multiselect" : s.kind === "yesno" || s.kind === "radio" ? "select" : "text";
        return {
          key: s.key,
          label: s.label,
          type,
          required: s.required,
          options: s.options.length ? s.options.map((o) => ({ label: o, value: o })) : undefined,
          value: "",
          source: "empty",
          widget: s.kind === "yesno" || s.kind === "radio" || s.kind === "checkboxes" || s.kind === "combobox" ? s.kind : undefined,
        };
      });
  } finally {
    await browser.close();
  }
}
