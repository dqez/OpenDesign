import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type OutputKeys = {
  tokens: string;
  designMd: string;
  brandGuide: string;
};

export function buildOutputKeys(domain: string, jobId: string): OutputKeys {
  return {
    tokens: `${domain}/${jobId}/tokens.json`,
    designMd: `${domain}/${jobId}/DESIGN.md`,
    brandGuide: `${domain}/${jobId}/brand-guide.pdf`,
  };
}

export async function findDembrandtOutputFiles(workdir: string, domain: string) {
  const outputDir = join(workdir, "output", domain);
  const entries = await readdir(outputDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();

  const tokens = files.find((file) => file.endsWith(".tokens.json"));
  const designMd = files.find((file) => file === "DESIGN.md");
  const brandGuide = files.find(
    (file) => file.includes("brand-guide") && file.endsWith(".pdf"),
  );

  if (!tokens || !designMd || !brandGuide) {
    throw new Error(
      `missing_dembrandt_outputs:${outputDir}:found=${files.join(",")}`,
    );
  }

  return {
    tokens: join(outputDir, tokens),
    designMd: join(outputDir, designMd),
    brandGuide: join(outputDir, brandGuide),
  };
}

export function buildWorkdir(jobId: string) {
  const prefix = process.env.WORKDIR_PREFIX ?? "opendesign";
  return join(tmpdir(), `${prefix}-${jobId}`);
}

export async function runDembrandt(url: string, jobId: string) {
  const domain = new URL(url).hostname.replace(/^www\./, "");
  const workdir = buildWorkdir(jobId);
  await mkdir(workdir, { recursive: true });

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "npx",
        [
          "dembrandt",
          url,
          "--save-output",
          "--dtcg",
          "--design-md",
          "--brand-guide",
          "--pages",
          "5",
          "--sitemap",
          "--slow",
        ],
        { cwd: workdir, shell: false },
      );
      child.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`dembrandt exited ${code}`)),
      );
      child.on("error", reject);
    });

    const outputFiles = await findDembrandtOutputFiles(workdir, domain);
    const files = {
      tokens: await readFile(outputFiles.tokens),
      designMd: await readFile(outputFiles.designMd),
      brandGuide: await readFile(outputFiles.brandGuide),
    };
    return { domain, files };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}
