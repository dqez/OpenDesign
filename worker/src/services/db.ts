export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type CreateJobInput = {
  jobId: string;
  url: string;
  domain: string;
  email: string;
  ipHash: string;
  paid: boolean;
  orderCode: string | null;
};

export type JobRecord = {
  job_id: string;
  url: string;
  domain: string;
  email: string;
  ip_hash: string;
  status: JobStatus;
  paid: number;
  order_code: string | null;
  r2_keys: string | null;
  failure_reason: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export async function createJob(db: D1Database, input: CreateJobInput) {
  const now = new Date().toISOString();
  return db
    .prepare(
      "INSERT INTO jobs (job_id, url, domain, email, ip_hash, status, paid, order_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      input.jobId,
      input.url,
      input.domain,
      input.email,
      input.ipHash,
      "queued",
      input.paid ? 1 : 0,
      input.orderCode,
      now,
    )
    .run();
}

export async function getJob(db: D1Database, jobId: string) {
  return db
    .prepare("SELECT * FROM jobs WHERE job_id = ?")
    .bind(jobId)
    .first<JobRecord>();
}

export async function updateJobStatus(
  db: D1Database,
  jobId: string,
  status: JobStatus,
  details: { r2Keys?: unknown; failureReason?: string } = {},
) {
  const now = new Date().toISOString();
  if (status === "completed") {
    return db
      .prepare(
        "UPDATE jobs SET status = ?, r2_keys = ?, completed_at = ? WHERE job_id = ?",
      )
      .bind(status, JSON.stringify(details.r2Keys ?? null), now, jobId)
      .run();
  }
  if (status === "failed") {
    return db
      .prepare(
        "UPDATE jobs SET status = ?, failure_reason = ?, completed_at = ? WHERE job_id = ?",
      )
      .bind(status, details.failureReason ?? "unknown error", now, jobId)
      .run();
  }
  return db
    .prepare(
      "UPDATE jobs SET status = ?, started_at = COALESCE(started_at, ?) WHERE job_id = ?",
    )
    .bind(status, now, jobId)
    .run();
}
