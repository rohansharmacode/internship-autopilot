export type Source = "greenhouse" | "lever" | "ashby";

/** Where a listing came from. "external" postings (Workday and others) are tracked but applied to by you. */
export type JobSource = Source | "external";

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

export type SavedAnswer = { question: string; answer: string; savedAt: string };

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
  postalCode: string;
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
  /** Spoken languages, used for "which languages do you speak" questions. */
  languages: string[];
  /** Answers you gave to custom questions, reused when the same question appears again. */
  savedAnswers: SavedAnswer[];
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
  source: JobSource;
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
  /** What the listing says about visa sponsorship, when known. */
  sponsorship?: string;
  /** Which feed found it: a company's own job board, or the community internship list. */
  via: "board" | "community";
  firstSeenAt?: string;
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
  /** How the site draws this question, when it isn't a plain input (Ashby's Yes/No buttons, for example). */
  widget?: "yesno" | "radio" | "checkboxes" | "combobox";
};

export type ApplicationStatus =
  | "draft"
  | "sending"
  | "submitted"
  | "needs_you"
  | "failed"
  | "skipped";

export type Outcome = "waiting" | "interview" | "offer" | "rejected" | "withdrawn";

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
  /** What happened after you applied. You set this; the app can't read your inbox. */
  outcome?: Outcome;
  notes?: string;
  /** True when autopilot prepared or sent it rather than you. */
  byAutopilot?: boolean;
};

export type Board = { source: Source; token: string };

export type Settings = {
  boards: Board[];
  /** Fill the form but stop before pressing Submit. */
  rehearsal: boolean;
  /** Keep the browser window visible so captchas and unknown questions can be handled by you. */
  showBrowser: boolean;
  dailyLimit: number;
  /** Also pull internships from the SimplifyJobs community list on GitHub. */
  communityList: boolean;
  lastSearchAt?: string;
  autopilot: AutopilotSettings;
};

export type AutopilotSettings = {
  /** Search and prepare drafts on a schedule while the app is running. */
  enabled: boolean;
  everyHours: number;
  prepareCount: number;
  /**
   * Also send drafts without asking, but only when every required answer came from your profile or
   * your remembered answers (none written by Claude) and the match score is at least autoSendMinScore.
   */
  autoSend: boolean;
  autoSendMinScore: number;
  lastRunAt?: string;
  log: string[];
};

export type Db = {
  profile: Profile;
  jobs: Job[];
  applications: Application[];
  settings: Settings;
};
