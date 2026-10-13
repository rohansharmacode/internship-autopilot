import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseGreenhouseQuestions } from "../forms/greenhouse";
import { parseLeverApplyPage } from "../forms/lever";
import { parseAshby } from "../sources/ashby";
import { parseGreenhouse } from "../sources/greenhouse";
import { boardFromUrl } from "../sources";
import { parseLever } from "../sources/lever";

const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures", name), "utf8");

describe("job board parsers", () => {
  it("keeps only Greenhouse internships and points at the hosted form", () => {
    const jobs = parseGreenhouse("figma", {
      jobs: [
        { id: 1, title: "Data Engineer Intern (2027)", absolute_url: "https://figma.com/jobs/1", location: { name: "SF" }, content: "&lt;p&gt;Hi&lt;/p&gt;" },
        { id: 2, title: "Staff Engineer", absolute_url: "https://figma.com/jobs/2" },
      ],
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: "greenhouse:figma:1", applyUrl: "https://job-boards.greenhouse.io/figma/jobs/1", description: "Hi" });
  });

  it("uses Lever's commitment as well as the title", () => {
    const jobs = parseLever("palantir", [
      { id: "a", text: "Deployment Strategist", hostedUrl: "h", applyUrl: "h/apply", categories: { commitment: "Internship", location: "Paris" } },
      { id: "b", text: "Engineer", hostedUrl: "h", applyUrl: "h/apply", categories: { commitment: "Full-time" } },
    ]);
    expect(jobs.map((j) => j.externalId)).toEqual(["a"]);
  });

  it("uses Ashby's employment type", () => {
    const jobs = parseAshby("ramp", {
      jobs: [
        { id: "x", title: "Software Engineer", employmentType: "Intern", jobUrl: "https://jobs.ashbyhq.com/ramp/x", isRemote: true, location: "NYC" },
        { id: "y", title: "Software Engineer", employmentType: "FullTime", jobUrl: "u" },
      ],
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].location).toBe("NYC · Remote");
  });

  it("recognises board links", () => {
    expect(boardFromUrl("https://job-boards.greenhouse.io/figma/jobs/123")).toEqual({ source: "greenhouse", token: "figma" });
    expect(boardFromUrl("https://boards.greenhouse.io/embed/job_board?for=stripe")).toEqual({ source: "greenhouse", token: "stripe" });
    expect(boardFromUrl("https://jobs.lever.co/palantir/abc")).toEqual({ source: "lever", token: "palantir" });
    expect(boardFromUrl("https://jobs.ashbyhq.com/ramp")).toEqual({ source: "ashby", token: "ramp" });
    expect(boardFromUrl("https://example.com")).toBeNull();
  });
});

describe("application forms", () => {
  it("reads a real Greenhouse question set", () => {
    const fields = parseGreenhouseQuestions(JSON.parse(fixture("greenhouse-questions.json")));
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
    expect(byKey.first_name).toMatchObject({ type: "text", required: true });
    expect(byKey.resume).toMatchObject({ type: "file", required: true });
    expect(byKey.location).toMatchObject({ type: "text", required: true });
    expect(byKey.latitude).toBeUndefined();
    const auth = fields.find((f) => /authorized to work/i.test(f.label));
    expect(auth?.options?.map((o) => o.label)).toEqual(["Yes", "No"]);
  });

  it("reads Lever's standard fields and custom cards from the apply page", () => {
    const fields = parseLeverApplyPage(fixture("lever-apply.html"));
    const keys = fields.map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(["resume", "name", "email", "phone", "urls[LinkedIn]", "urls[GitHub]"]));
    const languages = fields.find((f) => /Language Skill/.test(f.label));
    expect(languages).toMatchObject({ type: "multiselect", required: true });
    expect(languages?.key).toMatch(/^cards\[[\w-]+\]\[field0\]$/);
    const sponsor = fields.find((f) => /sponsorship/i.test(f.label));
    expect(sponsor).toMatchObject({ type: "select", required: true });
    expect(fields.find((f) => f.key === "location")?.required).toBe(true);
  });
});
