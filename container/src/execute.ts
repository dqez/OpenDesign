import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
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

export async function runDembrandt(url: string, jobId: string) {
  const domain = new URL(url).hostname;
  const workdir = join(tmpdir(), `2design-${jobId}`);
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

    const files = {
      tokens: await readFile(join(workdir, "tokens.json")),
      designMd: await readFile(join(workdir, "DESIGN.md")),
      brandGuide: await readFile(join(workdir, "brand-guide.pdf")),
    };
    return { domain, files };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}
