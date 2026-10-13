export type Source = "greenhouse" | "lever" | "ashby";

export type YesNo = "yes" | "no" | "";

/** Answers to the questions almost every application asks. Filled once on the profile page. */
export type StandardAnswers = {
  workAuthorized: YesNo;
  needsSponsorship: YesNo;
  willingToRelocate: YesNo;
  earliestStart: string;
  howDidYouHear: string;
  pronouns: string;
};

export type GithubRepo = {
  name: string;
  description: string;
  language: string;
  stars: number;
  url: string;
};

export type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  school: string;
  degree: string;
  major: string;
  graduationDate: string;
  gpa: string;
  linkedinUrl: string;
  githubUsername: string;
  portfolioUrl: string;
  summary: string;
  skills: string[];
  cv?: { fileName: string; storedPath: string; text: string; uploadedAt: string };
  linkedinText?: string;
  github?: { repos: GithubRepo[]; languages: string[]; importedAt: string };
  answers: StandardAnswers;
  preferences: {
    keywords: string[];
    locations: string[];
    remoteOk: boolean;
    minScore: number;
  };
};

export type Job = {
  id: string;
  source: Source;
  board: string;
  externalId: string;
  company: string;
  title: string;
  location: string;
  url: string;
  applyUrl: string;
  description: string;
  postedAt: string;
  fetchedAt: string;
  score?: number;
  reasons?: string[];
  hidden?: boolean;
};

export type FieldType = "text" | "textarea" | "select" | "multiselect" | "checkbox" | "file";

export type FieldOption = { label: string; value: string };

export type FieldSource = "profile" | "ai" | "you" | "empty";

export type FormField = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: FieldOption[];
  /** For multiselect the values are joined with "\n". For file fields it is "resume" or "cover_letter". */
  value: string;
  source: FieldSource;
  note?: string;
};

export type ApplicationStatus =
  | "draft"
  | "sending"
  | "submitted"
  | "needs_you"
  | "failed"
  | "skipped";

export type Application = {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  fields: FormField[];
  coverLetter: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  log: string[];
  screenshot?: string;
};

export type Board = { source: Source; token: string };

export type Settings = {
  boards: Board[];
  /** Fill the form but stop before pressing Submit. */
  rehearsal: boolean;
  /** Keep the browser window visible so captchas and unknown questions can be handled by you. */
  showBrowser: boolean;
  dailyLimit: number;
};

export type Db = {
  profile: Profile;
  jobs: Job[];
  applications: Application[];
  settings: Settings;
};
