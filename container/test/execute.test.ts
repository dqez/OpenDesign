import { expect, it } from "vitest";
import { buildOutputKeys } from "../src/execute.js";

it("builds stable R2 keys for a job", () => {
  expect(buildOutputKeys("neon.com", "job_abc")).toEqual({
    tokens: "neon.com/job_abc/tokens.json",
    designMd: "neon.com/job_abc/DESIGN.md",
    brandGuide: "neon.com/job_abc/brand-guide.pdf",
  });
});
