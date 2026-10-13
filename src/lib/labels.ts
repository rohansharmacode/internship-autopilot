import type { ApplicationStatus } from "./types";

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: "Waiting for your approval",
  sending: "Sending",
  submitted: "Submitted",
  needs_you: "Needs you",
  failed: "Failed",
  skipped: "Skipped",
};
