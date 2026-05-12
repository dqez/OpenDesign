import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { buildOutputKeys, findDembrandtOutputFiles } from "../src/execute.js";

it("builds stable R2 keys for a job", () => {
  expect(buildOutputKeys("neon.com", "job_abc")).toEqual({
    tokens: "neon.com/job_abc/tokens.json",
    designMd: "neon.com/job_abc/DESIGN.md",
    brandGuide: "neon.com/job_abc/brand-guide.pdf",
  });
});

describe("findDembrandtOutputFiles", () => {
  const workdir = join(tmpdir(), `opendesign-output-test-${process.pid}`);

  afterEach(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  it("finds timestamped dembrandt files under output domain directory", async () => {
    const outputDir = join(workdir, "output", "neon.com");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "2026-05-08T13-33-00.tokens.json"), "{}");
    await writeFile(join(outputDir, "DESIGN.md"), "# Design");
    await writeFile(
      join(outputDir, "neon.com-brand-guide-2026-05-08-13-33.pdf"),
      "%PDF",
    );

    await expect(
      findDembrandtOutputFiles(workdir, "neon.com"),
    ).resolves.toEqual({
      tokens: join(outputDir, "2026-05-08T13-33-00.tokens.json"),
      designMd: join(outputDir, "DESIGN.md"),
      brandGuide: join(outputDir, "neon.com-brand-guide-2026-05-08-13-33.pdf"),
    });
  });

  it("reports available files when expected outputs are missing", async () => {
    const outputDir = join(workdir, "output", "neon.com");
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, "unexpected.txt"), "nope");

    await expect(findDembrandtOutputFiles(workdir, "neon.com")).rejects.toThrow(
      "missing_dembrandt_outputs",
    );
    await expect(findDembrandtOutputFiles(workdir, "neon.com")).rejects.toThrow(
      "unexpected.txt",
    );
  });
});
