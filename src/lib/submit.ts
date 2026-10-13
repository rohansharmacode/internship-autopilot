import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import type { Application, FormField, Source } from "./types";

export type SubmitInput = {
  source: Source;
  url: string;
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

const SUCCESS_TEXT = /thank you for (applying|your application|your interest)|application (has been |was )?(received|submitted)|we('ve| have) received your application|successfully submitted/i;
const SUBMIT_BUTTON = /^\s*(submit( application)?|apply|send application)\s*$/i;

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

async function fillField(page: Page, source: Source, field: FormField, files: SubmitInput["files"]): Promise<string | null> {
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
    for (const v of values) await page.locator(`input[name="${attr(field.key)}"][value="${attr(v)}"]`).first().check({ force: true });
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

async function succeeded(page: Page): Promise<boolean> {
  if (/confirmation|thank|submitted|success/i.test(page.url())) return true;
  const body = await page.locator("body").innerText().catch(() => "");
  return SUCCESS_TEXT.test(body);
}

async function waitForSuccess(page: Page, ms: number): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (page.isClosed()) return false;
    if (await succeeded(page).catch(() => false)) return true;
    await page.waitForTimeout(1000).catch(() => undefined);
  }
  return false;
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

    if (input.rehearsal) {
      log.push("Rehearsal: the form was filled but not submitted.");
      if (input.headed) await waitForSuccess(page, handoff);
      return { status: (await succeeded(page).catch(() => false)) ? "submitted" : "draft", log };
    }

    const button = page.getByRole("button", { name: SUBMIT_BUTTON }).or(page.locator('button[type=submit], input[type=submit]')).first();
    if ((await button.count()) === 0) {
      log.push("Could not find the Submit button.");
    } else {
      await button.click();
      log.push("Pressed Submit.");
      if (await waitForSuccess(page, 20000)) {
        await page.screenshot({ path: input.screenshotPath, fullPage: true }).catch(() => undefined);
        log.push("The site confirmed the application.");
        return { status: "submitted", log };
      }
    }

    if (await challengeVisible(page)) log.push("The site is asking for a captcha. Solve it in the open window and press Submit.");
    for (const e of await validationErrors(page)) log.push(`Page says: ${e}`);

    if (input.headed) {
      log.push("Waiting for you to finish in the browser window.");
      if (await waitForSuccess(page, handoff)) {
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
