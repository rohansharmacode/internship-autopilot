import type { FormField } from "../types";

/**
 * Ashby renders its form in the browser, so the app starts from the fields every Ashby form has.
 * Any extra questions are found by label when the browser fills the form; whatever it cannot
 * answer is left for you in the open window.
 */
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
    f("phone", "Phone", "text", false),
    f("_systemfield_resume", "Resume", "file", true),
    f("linkedin", "LinkedIn", "text", false),
    f("github", "GitHub", "text", false),
    f("website", "Website", "text", false),
    f("why", "Why do you want to work here?", "textarea", false),
  ];
}
