import type { FormField, Job } from "../types";
import { ashbyStandardForm } from "./ashby";
import { loadGreenhouseForm } from "./greenhouse";
import { loadLeverForm } from "./lever";

export async function loadForm(job: Job): Promise<FormField[]> {
  switch (job.source) {
    case "greenhouse":
      return loadGreenhouseForm(job.board, job.externalId);
    case "lever":
      return loadLeverForm(job.applyUrl);
    case "ashby":
      return ashbyStandardForm();
  }
}
