import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseAgo, parseSimplytkPage } from "../sources/simplytk";

const html = readFileSync(path.join(__dirname, "fixtures/simplytk-tracker.html"), "utf8");
const now = Date.UTC(2026, 9, 13, 12);

describe("parseSimplytkPage", () => {
  const jobs = parseSimplytkPage(html, now);

  it("reads internships and spring weeks and leaves graduate jobs out", () => {
    expect(jobs.map((j) => j.company)).toEqual(["Waymo", "Macquarie Group"]);
  });

  it("keeps the role, place, programme and apply link", () => {
    expect(jobs[0]).toMatchObject({
      source: "external",
      title: "2027 Summer Intern, PhD, Machine Learning, Simulation Realism",
      location: "London, England, United Kingdom",
      applyUrl: "https://careers.withwaymo.com/jobs?gh_jid=8265868",
      via: "tracker",
      postedAt: new Date(now - 2 * 3600e3).toISOString(),
    });
    expect(jobs[0].description).toContain("Programme: Summer internship");
    expect(jobs[1].description).toContain("Programme: Spring week");
    expect(jobs[1].description).toContain("First years");
  });

  it("uses the job board's own id for postings the app can fill in", () => {
    const gh = html.replace("https://recruitment.macquarie.com/en_US/careers/JobDetail?jobId=24250", "https://job-boards.greenhouse.io/macquarie/jobs/123");
    const job = parseSimplytkPage(gh, now).find((j) => j.company === "Macquarie Group");
    expect(job).toMatchObject({ id: "greenhouse:macquarie:123", source: "greenhouse", applyUrl: "https://job-boards.greenhouse.io/macquarie/jobs/123" });
  });
});

describe("parseAgo", () => {
  it("turns relative times into dates", () => {
    expect(parseAgo("3 days ago", now)).toBe(new Date(now - 3 * 86400e3).toISOString());
    expect(parseAgo("yesterday", now)).toBe(new Date(now - 86400e3).toISOString());
    expect(parseAgo("just now", now)).toBe(new Date(now).toISOString());
  });
});
