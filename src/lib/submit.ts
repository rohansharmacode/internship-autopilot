import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import type { Application, FormField, Source } from "./types";

export type SubmitInput = {
  source: Source;
  url: string;
  /** Tried when the form isn't on the first page, e.g. a company that redirects its Greenhouse page to its own site. */
  fallbackUrl?: string;
  fields: FormField[];
  files: { resume?: string; cover_letter?: string };
  /** Fill everything but leave the Submit button alone. */
  rehearsal: boolean;
  /** Show the browser window, and wait in it for you when something needs a person. */
  headed: boolean;
  screenshotPath: string;
  /** How long to wait for you to finish in the open window before giving up. */
  handoffTimeoutMs?: number;
};

export type SubmitResult = { status: Application["status"]; log: string[] };

const SUCCESS_TEXT = /thank you for (applying|your application|your interest)|application (has been |was )?(received|submitted)|we('ve| have) received your application|successfully submitted/gi;
// Most specific first: job pages often also have an "Apply" button at the top that only scrolls to the form.
const SUBMIT_BUTTONS = [/^\s*submit application\s*$/i, /^\s*submit\s*$/i, /^\s*send application\s*$/i, /^\s*apply( now)?\s*$/i];

function attr(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function firstVisible(candidates: Locator[]): Promise<Locator | null> {
  for (const c of candidates) {
    const n = await c.count().catch(() => 0);
    if (n > 0) return c.first();
  }
  return null;
}

async function locate(page: Page, source: Source, field: FormField): Promise<Locator | null> {
  const key = attr(field.key);
  const ids = source === "greenhouse" && field.key === "location" ? ["candidate-location", "location"] : [field.key];
  return firstVisible([
    ...ids.map((id) => page.locator(`[id="${attr(id)}"]`)),
    page.locator(`[name="${key}"]`),
    page.locator(`label[for="${key}"]`).locator('xpath=ancestor::*[contains(@class, "field-entry")][1]//*[self::input or self::textarea][not(@type="hidden")]'),
    page.getByLabel(field.label, { exact: true }),
    page.getByLabel(field.label),
  ]);
}

async function pickFromCombobox(page: Page, input: Locator, text: string, loose: boolean): Promise<void> {
  await input.click();
  // Place pickers search as you type, so give them just the city.
  await input.fill(loose ? text.split(",")[0].trim() : text);
  const exact = page.getByRole("option", { name: text, exact: true });
  const close = page.getByRole("option", { name: text });
  const any = page.getByRole("option");
  try {
    await exact.or(close).first().waitFor({ state: "visible", timeout: loose ? 2500 : 6000 });
    await exact.or(close).first().click();
  } catch (err) {
    if (!loose) throw err;
    await any.first().waitFor({ state: "visible", timeout: 6000 });
    await any.first().click();
  }
}

/** Ashby draws Yes/No buttons, radio lists and checkbox lists; each answer is clicked by its visible text. */
async function fillWidget(page: Page, field: FormField): Promise<string | null> {
  const entry = page
    .locator(`label[for="${attr(field.key)}"], legend[for="${attr(field.key)}"]`)
    .first()
    .locator('xpath=ancestor::*[self::fieldset or contains(@class, "field-entry")][1]');
  if ((await entry.count()) === 0) return `Could not find "${field.label}" on the page`;
  const values = field.type === "multiselect" ? field.value.split("\n").filter(Boolean) : [field.value];
  for (const v of values) {
    if (field.widget === "yesno") {
      await entry.getByRole("button", { name: v, exact: true }).first().click();
    } else if (field.widget === "combobox") {
      await pickFromCombobox(page, entry.getByRole("combobox").first(), v, true);
    } else {
      await entry.locator("label").filter({ hasText: new RegExp(`^\\s*${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`) }).first().click();
    }
  }
  return null;
}

async function checkHard(box: Locator): Promise<void> {
  try {
    await box.check({ force: true, timeout: 3000 });
  } catch {
    // Some sites hide the real checkbox behind a styled label; clicking the label is what a person does.
    const id = await box.getAttribute("id");
    const label = id ? box.page().locator(`label[for="${attr(id)}"]`) : box.locator("xpath=ancestor::label[1]");
    await label.first().click();
  }
}

async function fillField(page: Page, source: Source, field: FormField, files: SubmitInput["files"]): Promise<string | null> {
  if (field.widget && field.type !== "file") return fillWidget(page, field);
  if (field.type === "file") {
    const file = files[field.value as keyof SubmitInput["files"]];
    if (!file) return `No file for ${field.label}`;
    const el = await firstVisible([
      page.locator(`[id="${attr(field.key)}"][type=file]`),
      page.locator(`input[type=file][name="${attr(field.key)}"]`),
      page.getByLabel(field.label).locator("xpath=self::input[@type='file']"),
      page.locator(`input[type=file]`).nth(field.value === "cover_letter" ? 1 : 0),
    ]);
    if (!el) return `Could not find the upload for ${field.label}`;
    await el.setInputFiles(file);
    return null;
  }

  const values = field.type === "multiselect" ? field.value.split("\n").filter(Boolean) : [field.value];

  // Radio buttons and checkboxes share a name and carry the answer as their value.
  const group = page.locator(`input[name="${attr(field.key)}"]:is([type=radio],[type=checkbox])`);
  if ((await group.count()) > 0) {
    for (const v of values) await checkHard(page.locator(`input[name="${attr(field.key)}"][value="${attr(v)}"]`).first());
    return null;
  }

  const el = await locate(page, source, field);
  if (!el) return `Could not find "${field.label}" on the page`;
  const tag = await el.evaluate((n) => n.tagName.toLowerCase());
  const role = await el.getAttribute("role");

  if (tag === "select") {
    await el.selectOption(values.map((label) => ({ label })));
  } else if (role === "combobox") {
    for (const v of values) await pickFromCombobox(page, el, v, /location|city/i.test(field.label));
  } else if (tag === "input" && (await el.getAttribute("type")) === "checkbox") {
    if (/^(yes|true|i agree|agree)$/i.test(field.value)) await el.check({ force: true });
  } else {
    await el.fill(field.value);
  }
  return null;
}

async function challengeVisible(page: Page): Promise<boolean> {
  const frames = page.locator('iframe[src*="hcaptcha"][title*="hallenge"], iframe[src*="recaptcha"][title*="hallenge"], iframe[src*="challenges.cloudflare"]');
  const n = await frames.count();
  for (let i = 0; i < n; i++) if (await frames.nth(i).isVisible()) return true;
  return false;
}

/** What the page looked like before Submit, so text already in the job description isn't mistaken for a confirmation. */
type Baseline = { url: string; hits: string[] };

async function successHits(page: Page): Promise<string[]> {
  const body = await page.locator("body").innerText().catch(() => "");
  return (body.match(SUCCESS_TEXT) ?? []).map((m) => m.toLowerCase());
}

async function baseline(page: Page): Promise<Baseline> {
  return { url: page.url(), hits: await successHits(page) };
}

async function succeeded(page: Page, before: Baseline): Promise<boolean> {
  const url = page.url();
  if (url !== before.url && /confirmation|thank|submitted|success/i.test(url)) return true;
  const now = await successHits(page);
  // A new confirmation phrase, or more of the same one, means the page changed after Submit.
  return now.some((h) => !before.hits.includes(h)) || now.length > before.hits.length;
}

async function waitForSuccess(page: Page, before: Baseline, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (page.isClosed()) return false;
    if (await succeeded(page, before).catch(() => false)) return true;
    await page.waitForTimeout(1000).catch(() => undefined);
  }
  return false;
}

async function findSubmit(page: Page): Promise<Locator | null> {
  for (const name of SUBMIT_BUTTONS) {
    const b = page.getByRole("button", { name }).filter({ visible: true });
    if ((await b.count()) > 0) return b.last();
  }
  const generic = page.locator("button[type=submit]:visible, input[type=submit]:visible");
  return (await generic.count()) > 0 ? generic.last() : null;
}

async function validationErrors(page: Page): Promise<string[]> {
  const errs = await page
    .locator('[aria-invalid="true"], .error:visible, .field-error:visible, [role="alert"]:visible')
    .evaluateAll((nodes) =>
      nodes
        .map((n) => (n.getAttribute("aria-label") || n.textContent || "").trim())
        .filter(Boolean)
        .slice(0, 8),
    )
    .catch(() => [] as string[]);
  return [...new Set(errs)];
}

/** Whether the browser the app drives has been downloaded (npm run browsers). */
export function browserInstalled(): boolean {
  try {
    return existsSync(process.env.PLAYWRIGHT_CHROMIUM_PATH || chromium.executablePath());
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** Renders the cover letter as a plain one-page PDF, which every application form accepts. */
export async function writeCoverLetterPdf(text: string, file: string): Promise<void> {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage();
    const body = text
      .split(/\n{2,}/)
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
    await page.setContent(
      `<html><body style="font: 11.5pt/1.5 Georgia, serif; color: #111; margin: 0">${body}</body></html>`,
    );
    await fs.mkdir(path.dirname(file), { recursive: true });
    await page.pdf({ path: file, format: "A4", margin: { top: "25mm", bottom: "25mm", left: "25mm", right: "25mm" } });
  } finally {
    await browser.close();
  }
}

/**
 * Opens the employer's own application page, fills it from the approved answers and presses Submit.
 * Captchas are never bypassed: when one appears, or the page wants something the app could not fill,
 * the window stays open for you to finish and the application is marked "needs you" if you don't.
 */
export async function fillAndSubmit(input: SubmitInput): Promise<SubmitResult> {
  const log: string[] = [];
  const handoff = input.handoffTimeoutMs ?? 15 * 60 * 1000;
  const browser = await chromium.launch({
    headless: !input.headed,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });
  try {
    const page = await browser.newPage();
    await page.goto(input.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
    const firstKey = input.fields.find((f) => f.type !== "file")?.key;
    if (input.fallbackUrl && firstKey && (await locate(page, input.source, input.fields.find((f) => f.key === firstKey)!)) === null) {
      log.push("The form wasn't on the company's page, so the app opened the job board's own copy of it.");
      await page.goto(input.fallbackUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
    }

    for (const field of input.fields) {
      if (!field.value.trim()) {
        if (field.required) log.push(`Left empty (required): ${field.label}`);
        continue;
      }
      try {
        const problem = await fillField(page, input.source, field, input.files);
        if (problem) log.push(problem);
      } catch (err) {
        log.push(`Could not fill "${field.label}": ${(err as Error).message.split("\n")[0]}`);
      }
    }

    await fs.mkdir(path.dirname(input.screenshotPath), { recursive: true });
    await page.screenshot({ path: input.screenshotPath, fullPage: true });
    const before = await baseline(page);

    if (input.rehearsal) {
      log.push("Rehearsal: the form was filled but not submitted.");
      // In a visible window you can still press Submit yourself; the app notices if you do.
      const submittedByYou = input.headed && (await waitForSuccess(page, before, handoff));
      if (submittedByYou) log.push("You submitted it yourself; the site confirmed the application.");
      return { status: submittedByYou ? "submitted" : "draft", log };
    }

    const button = await findSubmit(page);
    if (!button) {
      log.push("Could not find the Submit button.");
    } else {
      await button.click();
      log.push("Pressed Submit.");
      if (await waitForSuccess(page, before, 20000)) {
        await page.screenshot({ path: input.screenshotPath, fullPage: true }).catch(() => undefined);
        log.push("The site confirmed the application.");
        return { status: "submitted", log };
      }
    }

    if (await challengeVisible(page)) log.push("The site is asking for a captcha. Solve it in the open window and press Submit.");
    for (const e of await validationErrors(page)) log.push(`Page says: ${e}`);

    if (input.headed) {
      log.push("Waiting for you to finish in the browser window.");
      if (await waitForSuccess(page, before, handoff)) {
        log.push("You finished it; the site confirmed the application.");
        return { status: "submitted", log };
      }
    }
    await page.screenshot({ path: input.screenshotPath, fullPage: true }).catch(() => undefined);
    return { status: "needs_you", log };
  } finally {
    await browser.close().catch(() => undefined);
  }
}
