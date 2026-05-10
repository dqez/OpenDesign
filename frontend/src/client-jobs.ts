import type { JobResponse } from "./api";

export type ClientJobStatus = JobResponse["status"];

export type ClientJobRecord = {
  jobId: string;
  url: string;
  email: string;
  status: ClientJobStatus;
  createdAt: string;
  updatedAt: string;
  files?: JobResponse["files"];
  failureReason?: string;
};

export const CLIENT_JOBS_CHANGED_EVENT = "client-jobs:changed";

const CLIENT_JOBS_STORAGE_KEY = "opendesign.extract.jobs.v1";
const MAX_CLIENT_JOBS = 8;

type ClientJobInput = Omit<ClientJobRecord, "createdAt" | "updatedAt"> & {
  createdAt?: string;
  updatedAt?: string;
};

export function getClientJobs(): ClientJobRecord[] {
  if (!hasStorage()) return [];

  try {
    const raw = window.localStorage.getItem(CLIENT_JOBS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isClientJobRecord) : [];
  } catch {
    return [];
  }
}

export function getClientJob(jobId: string): ClientJobRecord | null {
  return getClientJobs().find((job) => job.jobId === jobId) ?? null;
}

export function upsertClientJob(input: ClientJobInput): ClientJobRecord[] {
  const now = new Date().toISOString();
  const jobs = getClientJobs();
  const existing = jobs.find((job) => job.jobId === input.jobId);
  const next: ClientJobRecord = {
    ...existing,
    ...input,
    createdAt: input.createdAt ?? existing?.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };

  return saveClientJobs([
    next,
    ...jobs.filter((job) => job.jobId !== input.jobId),
  ]);
}

export function updateClientJobFromResponse(job: JobResponse): ClientJobRecord[] {
  const existing = getClientJob(job.jobId);
  if (!existing) return getClientJobs();

  return upsertClientJob({
    ...existing,
    status: job.status,
    files: job.files,
    failureReason: job.failureReason,
  });
}

export function removeClientJob(jobId: string): ClientJobRecord[] {
  return saveClientJobs(getClientJobs().filter((job) => job.jobId !== jobId));
}

function saveClientJobs(jobs: ClientJobRecord[]): ClientJobRecord[] {
  const next = jobs.slice(0, MAX_CLIENT_JOBS);
  if (!hasStorage()) return next;

  try {
    window.localStorage.setItem(CLIENT_JOBS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CLIENT_JOBS_CHANGED_EVENT));
  } catch {
    return next;
  }

  return next;
}

function hasStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function isClientJobRecord(value: unknown): value is ClientJobRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.jobId === "string" &&
    typeof value.url === "string" &&
    typeof value.email === "string" &&
    isClientJobStatus(value.status) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isClientJobStatus(value: unknown): value is ClientJobStatus {
  return (
    value === "queued" ||
    value === "processing" ||
    value === "completed" ||
    value === "failed"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
