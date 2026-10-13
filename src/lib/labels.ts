import type { ApplicationStatus, Outcome } from "./types";

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: "Waiting for your approval",
  sending: "Sending",
  submitted: "Submitted",
  needs_you: "Needs you",
  failed: "Failed",
  skipped: "Skipped",
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  waiting: "Waiting to hear back",
  interview: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};
