import { describe, expect, it } from "vitest";
import { autoSendBlocker } from "../autopilot";
import { emptyDb } from "../defaults";
import type { Application, FormField, Job } from "../types";

const settings = emptyDb().settings;
const job: Job = {
  id: "greenhouse:x:1", source: "greenhouse", board: "x", externalId: "1", company: "X", title: "SWE Intern", location: "", url: "",
  applyUrl: "", description: "", postedAt: "", fetchedAt: "", via: "board", score: 80,
};
const field = (over: Partial<FormField>): FormField => ({ key: "k", label: "Q", type: "text", required: true, value: "v", source: "profile", ...over });
const app = (fields: FormField[]): Application => ({ id: "a", jobId: job.id, status: "draft", fields, coverLetter: "", createdAt: "", updatedAt: "", log: [] });

describe("autoSendBlocker", () => {
  it("allows an application answered entirely from the profile", () => {
    expect(autoSendBlocker(app([field({}), field({ key: "b", required: false, value: "", source: "empty" })]), job, settings)).toBeNull();
  });
  it("holds back anything Claude wrote, anything missing, low scores and other sites", () => {
    expect(autoSendBlocker(app([field({ source: "ai" })]), job, settings)).toMatch(/needs your check/);
    expect(autoSendBlocker(app([field({ value: "", source: "empty" })]), job, settings)).toMatch(/empty/);
    expect(autoSendBlocker(app([field({})]), { ...job, score: 10 }, settings)).toMatch(/below/);
    expect(autoSendBlocker(app([field({})]), { ...job, source: "external" }, settings)).toMatch(/can't be filled/);
    expect(autoSendBlocker(app([field({})]), undefined, settings)).toMatch(/closed/);
  });
});
