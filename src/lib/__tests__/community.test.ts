import { describe, expect, it } from "vitest";
import { scoreJob } from "../match";
import { parseCommunityList, parsePostingUrl } from "../sources/community";
import { sampleProfile } from "./helpers";

describe("parsePostingUrl", () => {
  it("finds the board and posting for each supported site", () => {
    expect(parsePostingUrl("https://job-boards.greenhouse.io/figma/jobs/6178851004?utm_source=Simplify")).toMatchObject({
      source: "greenhouse",
      board: "figma",
      externalId: "6178851004",
      applyUrl: "https://job-boards.greenhouse.io/figma/jobs/6178851004",
    });
    expect(parsePostingUrl("https://boards.greenhouse.io/embed/job_app?for=stripe&token=123")).toMatchObject({ board: "stripe", externalId: "123" });
    expect(parsePostingUrl("https://jobs.lever.co/palantir/774cf5c9-bf6a-4d77-bf60-d50ef1beb1a0")?.applyUrl).toBe(
      "https://jobs.lever.co/palantir/774cf5c9-bf6a-4d77-bf60-d50ef1beb1a0/apply",
    );
    expect(parsePostingUrl("https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245")?.source).toBe("ashby");
    expect(parsePostingUrl("https://amfam.wd1.myworkdayjobs.com/Careers/job/X_R1")).toBeNull();
    expect(parsePostingUrl("not a url")).toBeNull();
  });
});

describe("parseCommunityList", () => {
  const now = Date.UTC(2026, 9, 13);
  const base = { company_name: "Figma", active: true, is_visible: true, date_posted: now / 1000 - 86400, locations: ["SF"] };
  it("keeps fresh, active internships and marks unsupported sites as external", () => {
    const jobs = parseCommunityList(
      [
        { ...base, id: "1", title: "Software Engineer Intern", url: "https://job-boards.greenhouse.io/figma/jobs/1?utm_source=Simplify", sponsorship: "Offers Sponsorship" },
        { ...base, id: "2", title: "Data Intern", url: "https://x.wd1.myworkdayjobs.com/c/job/2" },
        { ...base, id: "3", title: "Old Intern", url: "https://jobs.lever.co/a/b", date_posted: now / 1000 - 400 * 86400 },
        { ...base, id: "4", title: "Closed Intern", url: "https://jobs.lever.co/a/b", active: false },
      ],
      now,
    );
    expect(jobs.map((j) => j.id)).toEqual(["greenhouse:figma:1", "external:2"]);
    expect(jobs[0]).toMatchObject({ via: "community", sponsorship: "Offers Sponsorship", source: "greenhouse" });
    expect(jobs[1].source).toBe("external");
  });
});

describe("sponsorship", () => {
  it("marks down roles that won't sponsor when you need it", () => {
    const p = sampleProfile();
    p.answers.needsSponsorship = "yes";
    const job = { title: "Software Engineer Intern", location: "NYC", description: "" };
    const no = scoreJob({ ...job, sponsorship: "Does Not Offer Sponsorship" }, p);
    const yes = scoreJob({ ...job, sponsorship: "Offers Sponsorship" }, p);
    expect(yes.score).toBeGreaterThan(no.score);
    expect(no.reasons).toContain("Does Not Offer Sponsorship");
  });
});
