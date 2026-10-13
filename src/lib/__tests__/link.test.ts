import { describe, expect, it } from "vitest";
import { jobFromLink, LinkError } from "../sources/link";

describe("jobFromLink", () => {
  it("asks for the employer's link when given a listings site", async () => {
    await expect(jobFromLink("https://app.the-trackr.com/uk-tech")).rejects.toBeInstanceOf(LinkError);
    await expect(jobFromLink("https://www.linkedin.com/jobs/view/123")).rejects.toThrow(/Apply button/);
  });

  it("rejects text that isn't a link", async () => {
    await expect(jobFromLink("software intern at stripe")).rejects.toThrow(/doesn't look like a link/);
  });
});
