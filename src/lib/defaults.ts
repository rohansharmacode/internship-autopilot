import type { Board, Db, Profile } from "./types";

export const DEFAULT_BOARDS: Board[] = [
  ...["anthropic", "stripe", "databricks", "figma", "robinhood", "cloudflare", "coinbase", "pinterest", "lyft", "roblox", "datadog", "affirm", "scaleai", "reddit", "samsara"].map(
    (token) => ({ source: "greenhouse" as const, token }),
  ),
  { source: "lever", token: "palantir" },
  ...["ramp", "notion", "openai", "replit"].map((token) => ({ source: "ashby" as const, token })),
];

export function emptyProfile(): Profile {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    city: "",
    country: "",
    school: "",
    degree: "",
    major: "",
    graduationDate: "",
    gpa: "",
    linkedinUrl: "",
    githubUsername: "",
    portfolioUrl: "",
    summary: "",
    skills: [],
    answers: {
      workAuthorized: "",
      needsSponsorship: "",
      willingToRelocate: "",
      earliestStart: "",
      howDidYouHear: "Company careers page",
      pronouns: "",
    },
    preferences: { keywords: ["software", "engineer", "data"], locations: [], remoteOk: true, minScore: 30 },
  };
}

export function emptyDb(): Db {
  return {
    profile: emptyProfile(),
    jobs: [],
    applications: [],
    settings: { boards: DEFAULT_BOARDS, rehearsal: false, showBrowser: true, dailyLimit: 15 },
  };
}
