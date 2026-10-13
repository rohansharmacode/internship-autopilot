import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fillAndSubmit } from "../submit";
import type { FormField } from "../types";

const html = readFileSync(path.join(__dirname, "fixtures", "form.html"), "utf8");
let server: Server;
let url = "";
const dir = mkdtempSync(path.join(os.tmpdir(), "autopilot-"));
const resume = path.join(dir, "cv.txt");
writeFileSync(resume, "My CV");

beforeAll(async () => {
  server = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/apply`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const f = (key: string, label: string, type: FormField["type"], value: string): FormField => ({ key, label, type, value, required: true, source: "profile" });

const fields: FormField[] = [
  f("first_name", "First Name", "text", "Rohan"),
  f("email", "Email", "text", "rohan@example.com"),
  f("question_1", "Are you authorized to work?", "select", "Yes"),
  f("resume", "Resume", "file", "resume"),
  f("cards[abc][field0]", "Will you need sponsorship?", "select", "No"),
  f("cards[abc][field1]", "Languages", "multiselect", "English\nHindi"),
  f("grad", "Graduation year", "select", "2027"),
  f("why", "Why us?", "textarea", "Because I like it."),
];

describe("fillAndSubmit", () => {
  it("fills text, combobox, radio, checkbox, select and file fields, then submits", async () => {
    const result = await fillAndSubmit({
      source: "greenhouse",
      url,
      fields,
      files: { resume },
      rehearsal: false,
      headed: false,
      screenshotPath: path.join(dir, "shot.png"),
    });
    expect(result.log.filter((l) => /Could not/.test(l))).toEqual([]);
    expect(result.status).toBe("submitted");
  });

  it("does not press Submit in rehearsal mode", async () => {
    const result = await fillAndSubmit({
      source: "greenhouse",
      url,
      fields,
      files: { resume },
      rehearsal: true,
      headed: false,
      screenshotPath: path.join(dir, "shot2.png"),
    });
    expect(result.status).toBe("draft");
  });

  it("hands over to you when the page rejects the form", async () => {
    const result = await fillAndSubmit({
      source: "greenhouse",
      url,
      fields: fields.filter((x) => x.key !== "why"),
      files: { resume },
      rehearsal: false,
      headed: false,
      screenshotPath: path.join(dir, "shot3.png"),
    });
    expect(result.status).toBe("needs_you");
    expect(result.log.join("\n")).toMatch(/Something is missing/);
  });
});
