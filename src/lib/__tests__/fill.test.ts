import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { autoFill, chooseOption, missingRequired } from "../fill";
import { parseGreenhouseQuestions } from "../forms/greenhouse";
import { parseLeverApplyPage } from "../forms/lever";
import { sampleProfile } from "./helpers";

const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures", name), "utf8");

describe("chooseOption", () => {
  const yesNo = [{ label: "Yes", value: "1" }, { label: "No", value: "0" }];
  it("matches yes and no", () => {
    expect(chooseOption(yesNo, "No")?.value).toBe("0");
    expect(chooseOption([{ label: "Yes, I am authorized", value: "a" }, { label: "No", value: "b" }], "Yes")?.value).toBe("a");
  });
  it("matches a school inside a longer option and refuses to guess otherwise", () => {
    const schools = [{ label: "University College London (UCL)", value: "u" }, { label: "Imperial College", value: "i" }];
    expect(chooseOption(schools, "University College London")?.value).toBe("u");
    expect(chooseOption(schools, "Oxford")).toBeNull();
  });
});

describe("autoFill", () => {
  const profile = sampleProfile();

  it("fills a Greenhouse form's standard questions from the profile", () => {
    const fields = autoFill(parseGreenhouseQuestions(JSON.parse(fixture("greenhouse-questions.json"))), profile);
    const v = (re: RegExp) => fields.find((f) => re.test(f.label))?.value;
    expect(v(/^First Name$/)).toBe("Rohan");
    expect(v(/^Last Name$/)).toBe("Sharma");
    expect(v(/^Email$/)).toBe("rohan@example.com");
    expect(v(/^Resume/)).toBe("resume");
    expect(v(/LinkedIn/)).toBe(profile.linkedinUrl);
    expect(v(/authorized to work/i)).toBe("Yes");
    expect(v(/worked for Figma before/i)).toBe("No");
    expect(fields.find((f) => /worked for Figma before/i.test(f.label))?.note).toMatch(/Assumed/);
    expect(v(/^Location$/)).toBe("London, United Kingdom");
    // June 2027 maps onto the form's term choices.
    expect(v(/expected graduation date/)).toBe("Spring 2027");
    // Company-specific questions are left for Claude or for you.
    expect(v(/Why do you want to join Figma/)).toBe("");
    expect(missingRequired(fields).map((f) => f.label)).toContain("Why do you want to join Figma?");
  });

  it("fills Lever's fields and choices", () => {
    const fields = autoFill(parseLeverApplyPage(fixture("lever-apply.html")), profile);
    const v = (re: RegExp) => fields.find((f) => re.test(f.label))?.value;
    expect(fields.find((f) => f.key === "name")?.value).toBe("Rohan Sharma");
    expect(fields.find((f) => f.key === "urls[GitHub]")?.value).toBe("https://github.com/rohansharmacode");
    expect(v(/require sponsorship/i)).toBe("No");
    expect(v(/legally authorized/i)).toBe("Yes");
    expect(v(/graduation year/i)).toBe("2027");
    expect(v(/graduation month/i)).toBe("June");
    expect(v(/how you heard/i)).toBe("Palantir Website");
  });

  it("never overwrites answers you typed", () => {
    const [f] = autoFill([{ key: "email", label: "Email", type: "text", required: true, value: "mine@x.com", source: "you" }], profile);
    expect(f.value).toBe("mine@x.com");
  });
});
