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

export async function createOrder(
  db: D1Database,
  input: {
    orderCode: string;
    url: string;
    email: string;
    ipHash: string;
    amount: number;
  },
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  return db
    .prepare(
      "INSERT INTO orders (order_code, url, email, ip_hash, amount, currency, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      input.orderCode,
      input.url,
      input.email,
      input.ipHash,
      input.amount,
      "VND",
      "pending",
      now.toISOString(),
      expiresAt,
    )
    .run();
}

export async function getOrderByCode(db: D1Database, orderCode: string) {
  return db
    .prepare("SELECT * FROM orders WHERE order_code = ?")
    .bind(orderCode)
    .first();
}

export async function recordWebhookEvent(
  db: D1Database,
  input: {
    webhookEventId: string;
    providerEventId: string;
    orderCode: string | null;
    status: "received" | "processed" | "ignored" | "failed";
    rawPayload: unknown;
  },
) {
  return db
    .prepare(
      "INSERT INTO webhook_events (webhook_event_id, provider, provider_event_id, order_code, status, raw_payload, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      input.webhookEventId,
      "sepay",
      input.providerEventId,
      input.orderCode,
      input.status,
      JSON.stringify(input.rawPayload),
      new Date().toISOString(),
    )
    .run();
}

export async function getWebhookEventByProviderEventId(
  db: D1Database,
  providerEventId: string,
) {
  return db
    .prepare(
      "SELECT * FROM webhook_events WHERE provider = ? AND provider_event_id = ?",
    )
    .bind("sepay", providerEventId)
    .first();
}

export async function recordPayment(
  db: D1Database,
  input: {
    paymentId: string;
    orderCode: string;
    providerTransactionId: string;
    referenceCode: string | null;
    amount: number;
    rawPayload: unknown;
  },
) {
  const now = new Date().toISOString();
  return db
    .prepare(
      "INSERT INTO payments (payment_id, order_code, provider, provider_transaction_id, reference_code, amount, raw_payload, received_at, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      input.paymentId,
      input.orderCode,
      "sepay",
      input.providerTransactionId,
      input.referenceCode,
      input.amount,
      JSON.stringify(input.rawPayload),
      now,
      now,
    )
    .run();
}

export async function markOrderPaid(db: D1Database, orderCode: string) {
  return db
    .prepare("UPDATE orders SET status = ?, paid_at = ? WHERE order_code = ?")
    .bind("paid", new Date().toISOString(), orderCode)
    .run();
}

export async function markWebhookEventProcessed(
  db: D1Database,
  providerEventId: string,
  status: "processed" | "ignored" | "failed",
) {
  return db
    .prepare(
      "UPDATE webhook_events SET status = ?, processed_at = ? WHERE provider = ? AND provider_event_id = ?",
    )
    .bind(status, new Date().toISOString(), "sepay", providerEventId)
    .run();
}

export async function recordEmailLog(
  db: D1Database,
  input: {
    emailLogId: string;
    jobId: string;
    email: string;
    template: string;
    providerMessageId: string | null;
    status: "sent" | "failed";
    error?: string | null;
  },
) {
  return db
    .prepare(
      "INSERT INTO email_logs (email_log_id, job_id, email, template, provider, provider_message_id, status, error, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      input.emailLogId,
      input.jobId,
      input.email,
      input.template,
      "resend",
      input.providerMessageId,
      input.status,
      input.error ?? null,
      new Date().toISOString(),
    )
    .run();
}
