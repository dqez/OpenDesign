import { buildOutputKeys, runDembrandt, type OutputKeys } from "./execute.js";
import { uploadObject } from "./r2.js";

export type ExtractionJob =
  | {
      jobId: string;
      status: "processing";
    }
  | {
      jobId: string;
      status: "completed";
      domain: string;
      files: OutputKeys;
    }
  | {
      jobId: string;
      status: "failed";
      error: string;
    };

const extractionJobs = new Map<string, ExtractionJob>();

export function startExtractionJob(jobId: string, url: string) {
  const existingJob = extractionJobs.get(jobId);
  if (existingJob) return existingJob;

  const job: ExtractionJob = { jobId, status: "processing" };
  extractionJobs.set(jobId, job);
  void runExtractionJob(jobId, url);
  return job;
}

export function getExtractionJob(jobId: string) {
  return extractionJobs.get(jobId) ?? null;
}

export function serializeExtractionJob(job: ExtractionJob) {
  if (job.status === "failed") {
    return {
      ok: false,
      jobId: job.jobId,
      status: job.status,
      error: job.error,
    };
  }

  if (job.status === "completed") {
    return {
      ok: true,
      jobId: job.jobId,
      status: job.status,
      domain: job.domain,
      files: job.files,
    };
  }

  return {
    ok: true,
    jobId: job.jobId,
    status: job.status,
  };
}

async function runExtractionJob(jobId: string, url: string) {
  try {
    const result = await runDembrandt(url, jobId);
    const keys = buildOutputKeys(result.domain, jobId);

    await uploadObject(keys.tokens, result.files.tokens, "application/json");
    await uploadObject(
      keys.designMd,
      result.files.designMd,
      "text/markdown; charset=utf-8",
    );
    await uploadObject(
      keys.brandGuide,
      result.files.brandGuide,
      "application/pdf",
    );

    extractionJobs.set(jobId, {
      jobId,
      status: "completed",
      domain: result.domain,
      files: keys,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown extraction error";
    if (process.env.NODE_ENV !== "test") {
      console.error(error);
    }
    extractionJobs.set(jobId, {
      jobId,
      status: "failed",
      error: message,
    });
  }
}
