import { describe, expect, it } from "vitest";
import { isInternship, scoreJob } from "../match";
import { extractSkills } from "../skills";
import { htmlToText } from "../text";
import { sampleProfile } from "./helpers";

describe("isInternship", () => {
  it("spots internship titles", () => {
    expect(isInternship("Software Engineer Intern (2027)")).toBe(true);
    expect(isInternship("Deployment Strategist, Internship")).toBe(true);
    expect(isInternship("Data Science Co-op")).toBe(true);
    expect(isInternship("Internal Tools Engineer")).toBe(false);
    expect(isInternship("Software Engineer", "Internship")).toBe(true);
  });
});

describe("extractSkills", () => {
  it("finds languages and frameworks without false single-letter hits", () => {
    const s = extractSkills("Built apps with React Native, Node.js and TypeScript. Some C++ and Go. A team of 5.");
    expect(s).toEqual(expect.arrayContaining(["React Native", "Node.js", "TypeScript", "C++", "Go"]));
    expect(extractSkills("I have a car and a dog")).not.toContain("C");
    expect(extractSkills("Languages: C, Python")).toContain("C");
  });
});

describe("scoreJob", () => {
  const profile = { ...sampleProfile(), preferences: { keywords: ["software"], locations: ["London"], remoteOk: true, minScore: 0 } };
  it("ranks a matching software internship above an unrelated one", () => {
    const good = scoreJob({ title: "Software Engineer Intern", location: "London, UK", description: "You will use TypeScript, React and SQL." }, profile);
    const weak = scoreJob({ title: "Legal Intern", location: "Tokyo", description: "Contracts and compliance." }, profile);
    expect(good.score).toBeGreaterThan(weak.score);
    expect(good.reasons.join(" ")).toMatch(/TypeScript/);
    expect(good.reasons).toContain("In London");
  });
  it("marks senior titles down", () => {
    const s = scoreJob({ title: "Senior Software Engineer", location: "Remote", description: "TypeScript" }, profile);
    expect(s.reasons).toContain("Title reads as a senior role");
  });
});

describe("htmlToText", () => {
  it("decodes Greenhouse's escaped HTML", () => {
    expect(htmlToText("&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;&lt;ul&gt;&lt;li&gt;One&lt;/li&gt;&lt;/ul&gt;")).toBe("Hello & welcome\n• One");
  });
});
