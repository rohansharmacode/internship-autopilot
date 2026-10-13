import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { autoFill, chooseOption, missingRequired, rememberAnswers } from "../fill";
import { parseGreenhouseQuestions } from "../forms/greenhouse";
import { parseLeverApplyPage } from "../forms/lever";
import type { FormField } from "../types";
import { sampleProfile } from "./helpers";

const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures", name), "utf8");

describe("chooseOption", () => {
  const yesNo = [{ label: "Yes", value: "1" }, { label: "No", value: "0" }];
  it("matches yes and no", () => {
    expect(chooseOption(yesNo, "No")?.value).toBe("0");
    expect(chooseOption([{ label: "Yes, I am authorized", value: "a" }, { label: "No", value: "b" }], "Yes")?.value).toBe("a");
    expect(chooseOption([{ label: "None of the above", value: "n" }, { label: "No, I do not", value: "x" }], "No")?.value).toBe("x");
    expect(chooseOption([{ label: "None of the above", value: "n" }], "No")).toBeNull();
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

describe("languages and remembered answers", () => {
  it("ticks every language you speak", () => {
    const profile = { ...sampleProfile(), languages: ["English", "Hindi"] };
    const [f] = autoFill(
      [
        {
          key: "cards[x][field0]",
          label: "Language Skill(s) (Check all that apply)",
          type: "multiselect",
          required: true,
          options: ["English (ENG)", "Hindi (HIN)", "French (FRA)"].map((l) => ({ label: l, value: l })),
          value: "",
          source: "empty",
        },
      ],
      profile,
    );
    expect(f.value).toBe("English (ENG)\nHindi (HIN)");
  });

  it("reuses an answer you wrote before, but not one that names the company", () => {
    const profile = sampleProfile();
    const question = (label: string) => ({ key: "q", label, type: "textarea" as const, required: true, value: "", source: "empty" as const });
    profile.savedAnswers = rememberAnswers(
      profile,
      [
        { ...question("What's something you know an unreasonable amount about?"), value: "Trains.", source: "you" },
        { ...question("Why do you want to join Figma?"), value: "Design tools.", source: "you" },
        { ...question("Email"), value: "x@y.z", source: "you" },
      ],
      "Figma",
    );
    expect(profile.savedAnswers.map((a) => a.question)).toEqual(["What's something you know an unreasonable amount about?"]);
    const [f] = autoFill([question("What's something you know an unreasonable amount about?")], profile);
    expect(f).toMatchObject({ value: "Trains.", source: "profile" });
  });
});

describe("Ashby-style choices", () => {
  it("answers a sponsorship list with None and a degree list with the bachelor's option", () => {
    const opts = (...l: string[]) => l.map((x) => ({ label: x, value: x }));
    const fields = autoFill(
      [
        { key: "a", label: "Will you now or at any time in the future require sponsorship?", type: "select", required: true, options: opts("OPT", "H1B", "None", "Other"), value: "", source: "empty", widget: "radio" },
        { key: "b", label: "Degree Type", type: "multiselect", required: true, options: opts("Undergraduate/Bachelors", "Master's", "PhD"), value: "", source: "empty", widget: "checkboxes" },
      ],
      sampleProfile(),
    );
    expect(fields.map((f) => f.value)).toEqual(["None", "Undergraduate/Bachelors"]);
  });
});

describe("more standard questions", () => {
  it("answers postcode and previous employment", () => {
    const profile = { ...sampleProfile(), postalCode: "WC1E 6BT" };
    const q = (label: string, extra: Partial<FormField> = {}): FormField => ({ key: label, label, type: "text", required: true, value: "", source: "empty", ...extra });
    const yesNo = [{ label: "Yes", value: "1" }, { label: "No", value: "0" }];
    const [zip, before] = autoFill([q("Zip / postal code"), q("Have you been employed by Lyft, or any subsidiary?", { type: "select", options: yesNo })], profile);
    expect(zip.value).toBe("WC1E 6BT");
    expect(before.value).toBe("No");
  });
});
