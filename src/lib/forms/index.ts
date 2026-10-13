import type { FormField, Job } from "../types";
import { ashbyStandardForm, scrapeAshbyForm } from "./ashby";
import { loadGreenhouseForm } from "./greenhouse";
import { loadLeverForm } from "./lever";

export async function loadForm(job: Job): Promise<FormField[]> {
  switch (job.source) {
    case "greenhouse":
      return loadGreenhouseForm(job.board, job.externalId);
    case "lever":
      return loadLeverForm(job.applyUrl);
    case "ashby":
      try {
        const fields = await scrapeAshbyForm(job.applyUrl);
        if (fields.length) return fields;
      } catch {
        // Fall back to the fields every Ashby form has; the rest are left for you in the browser.
      }
      return ashbyStandardForm();
    case "external":
      throw new Error("This posting is on a site the app can't fill in. Open it and apply there.");
  }
}
