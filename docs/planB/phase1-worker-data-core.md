# Phase 1 Worker Data Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the core Worker API for free first extraction: request validation, IP usage tracking, D1 job persistence, rate limiting, CORS, queue enqueue, and job polling.

**Architecture:** The Worker exposes Hono routes under `/api`. D1 owns long-term records, KV owns short-lived IP counters and per-minute rate-limit buckets, R2 only generates signed result URLs, and the Queue receives job payloads.

**Tech Stack:** Hono, TypeScript, Zod, Nanoid, D1, KV, R2, Cloudflare Queues, Vitest, Wrangler.

---

## Task 1.1: D1 Core Schema

**Files:**

- Create: `worker/migrations/0001_init_core_tables.sql`
- Modify: `worker/wrangler.jsonc`

- [ ] **Step 1: Create migration**

```sql
CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  email TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  paid INTEGER NOT NULL DEFAULT 0,
  order_code TEXT,
  r2_keys TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  order_code TEXT PRIMARY KEY,
  job_id TEXT,
  url TEXT NOT NULL,
  email TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  created_at TEXT NOT NULL,
  paid_at TEXT,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id TEXT PRIMARY KEY,
  order_code TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  reference_code TEXT,
  amount INTEGER NOT NULL,
  raw_payload TEXT NOT NULL,
  received_at TEXT NOT NULL,
  verified_at TEXT,
  UNIQUE (provider, provider_transaction_id)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  webhook_event_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  order_code TEXT,
  status TEXT NOT NULL CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  raw_payload TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS email_logs (
  email_log_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  email TEXT NOT NULL,
  template TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
  error TEXT,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  event_id TEXT PRIMARY KEY,
  job_id TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'provider')),
  event_type TEXT NOT NULL,
  metadata TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_email ON jobs(email);
CREATE INDEX IF NOT EXISTS idx_jobs_domain ON jobs(domain);
CREATE INDEX IF NOT EXISTS idx_orders_status_expires ON orders(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_job_status ON email_logs(job_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_events_job_created ON audit_events(job_id, created_at);
```

- [ ] **Step 2: Configure Worker bindings**

`worker/wrangler.jsonc`:

```jsonc
{
  "name": "opendesign-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-05-06",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1
  },
  "kv_namespaces": [{ "binding": "KV", "id": "<kv-namespace-id>" }],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "opendesign-prod",
      "database_id": "<d1-database-uuid>",
      "preview_database_id": "<d1-preview-database-uuid>",
      "migrations_dir": "migrations",
      "migrations_table": "d1_migrations",
    },
  ],
  "r2_buckets": [{ "binding": "R2", "bucket_name": "opendesign-outputs" }],
  "queues": {
    "producers": [{ "queue": "extraction-queue", "binding": "EXTRACT_QUEUE" }],
    "consumers": [
      {
        "queue": "extraction-queue",
        "max_batch_size": 1,
        "max_batch_timeout": 30,
      },
    ],
  },
  "vars": {
    "DEV_ORIGIN": "http://localhost:5173",
    "FRONTEND_ORIGIN": "https://opendesign.pages.dev",
    "R2_BUCKET_NAME": "opendesign-outputs",
    "SEPAY_BANK_ACCOUNT": "",
    "SEPAY_BANK_NAME": "",
    "SEPAY_BANK_ACCOUNT_NAME": "",
  },
}
```

- [ ] **Step 3: Verify migration locally**

Run:

```bash
cd worker
npx wrangler d1 migrations apply opendesign-prod --local
npx wrangler d1 execute opendesign-prod --local --command "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name"
```

Expected: output includes `audit_events`, `email_logs`, `jobs`, `orders`, `payments`, and `webhook_events`.

- [ ] **Step 4: Commit**

```bash
git add worker/migrations/0001_init_core_tables.sql worker/wrangler.jsonc
git commit -m "feat: add D1 core schema"
```

## Task 1.2: IDs, Validation, and IP Hashing

**Files:**

- Create: `worker/src/services/ids.ts`
- Create: `worker/src/services/validation.ts`
- Create: `worker/src/services/ip.ts`
- Create: `worker/test/validation.test.ts`
- Create: `worker/test/ip.test.ts`

- [ ] **Step 1: Write validation tests**

```ts
import { describe, expect, it } from "vitest";
import { extractRequestSchema } from "../src/services/validation";

describe("extractRequestSchema", () => {
  it("accepts valid url and email", () => {
    const parsed = extractRequestSchema.parse({
      url: "https://neon.com",
      email: "user@example.com",
    });
    expect(parsed.url).toBe("https://neon.com/");
  });

  it("rejects non-http URLs", () => {
    expect(() =>
      extractRequestSchema.parse({
        url: "file:///etc/passwd",
        email: "user@example.com",
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Implement validation and IP utilities**

`worker/src/services/validation.ts`:

```ts
import { z } from "zod";

export const extractRequestSchema = z.object({
  url: z
    .string()
    .url()
    .transform((value) => new URL(value))
    .refine((url) => url.protocol === "https:" || url.protocol === "http:", {
      message: "URL must use http or https",
    })
    .transform((url) => url.toString()),
  email: z.string().email().max(320),
});
```

`worker/src/services/ip.ts`:

```ts
export function getClientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "0.0.0.0"
  );
}

export async function hashIp(ip: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}
```

`worker/src/services/ids.ts`:

```ts
import { nanoid } from "nanoid";

export const createJobId = () => `job_${nanoid(12)}`;
export const createEventId = () => `evt_${nanoid(12)}`;
export const createOrderCode = () => `OD-${nanoid(6).toUpperCase()}`;
```

- [ ] **Step 3: Verify**

Run:

```bash
cd worker
npm test -- validation.test.ts ip.test.ts
npm run typecheck
```

Expected: validation tests pass and TypeScript exits with code 0.

- [ ] **Step 4: Commit**

```bash
git add worker/src/services/ids.ts worker/src/services/validation.ts worker/src/services/ip.ts worker/test
git commit -m "feat: add request validation and IP hashing"
```

## Task 1.3: D1 and KV Services

**Files:**

- Create: `worker/src/services/db.ts`
- Create: `worker/src/services/kv.ts`
- Create: `worker/src/services/audit.ts`
- Create: `worker/test/db.test.ts`
- Create: `worker/test/kv.test.ts`

- [ ] **Step 1: Write service tests with mock bindings**

Test behavior:

```ts
import { describe, expect, it, vi } from "vitest";
import { createJob, getJob, updateJobStatus } from "../src/services/db";

function mockDb() {
  const run = vi.fn().mockResolvedValue({ success: true });
  const first = vi
    .fn()
    .mockResolvedValue({ job_id: "job_123", status: "queued" });
  const bind = vi.fn(() => ({ run, first }));
  const prepare = vi.fn(() => ({ bind }));
  return {
    db: { prepare } as unknown as D1Database,
    run,
    first,
    bind,
    prepare,
  };
}

it("creates a queued job", async () => {
  const { db, prepare, bind, run } = mockDb();
  await createJob(db, {
    jobId: "job_123",
    url: "https://neon.com/",
    domain: "neon.com",
    email: "user@example.com",
    ipHash: "sha256:abc",
    paid: false,
    orderCode: null,
  });
  expect(prepare).toHaveBeenCalledWith(
    expect.stringContaining("INSERT INTO jobs"),
  );
  expect(bind).toHaveBeenCalled();
  expect(run).toHaveBeenCalled();
});

it("reads a job by id", async () => {
  const { db } = mockDb();
  await expect(getJob(db, "job_123")).resolves.toMatchObject({
    job_id: "job_123",
  });
});

it("updates job status", async () => {
  const { db, prepare } = mockDb();
  await updateJobStatus(db, "job_123", "processing");
  expect(prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE jobs"));
});
```

- [ ] **Step 2: Implement D1 service**

`worker/src/services/db.ts`:

```ts
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
  return db.prepare("SELECT * FROM jobs WHERE job_id = ?").bind(jobId).first();
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
```

- [ ] **Step 3: Implement KV and audit services**

`worker/src/services/kv.ts`:

```ts
export type IpUsage = { count: number; firstSeen: string; lastSeen: string };

export async function getIpUsage(
  kv: KVNamespace,
  ipHash: string,
): Promise<IpUsage | null> {
  return kv.get<IpUsage>(`ip:${ipHash}`, "json");
}

export async function incrementIpUsage(
  kv: KVNamespace,
  ipHash: string,
): Promise<IpUsage> {
  const now = new Date().toISOString();
  const current = await getIpUsage(kv, ipHash);
  const next = {
    count: (current?.count ?? 0) + 1,
    firstSeen: current?.firstSeen ?? now,
    lastSeen: now,
  };
  await kv.put(`ip:${ipHash}`, JSON.stringify(next), {
    expirationTtl: 60 * 60 * 24 * 90,
  });
  return next;
}
```

`worker/src/services/audit.ts`:

```ts
import { createEventId } from "./ids";

export async function writeAuditEvent(
  db: D1Database,
  event: {
    jobId?: string;
    actorType: "user" | "system" | "provider";
    eventType: string;
    metadata: unknown;
  },
) {
  return db
    .prepare(
      "INSERT INTO audit_events (event_id, job_id, actor_type, event_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      createEventId(),
      event.jobId ?? null,
      event.actorType,
      event.eventType,
      JSON.stringify(event.metadata),
      new Date().toISOString(),
    )
    .run();
}
```

- [ ] **Step 4: Verify**

Run:

```bash
cd worker
npm test -- db.test.ts kv.test.ts
npm run typecheck
```

Expected: service tests pass and TypeScript exits with code 0.

- [ ] **Step 5: Commit**

```bash
git add worker/src/services worker/test/db.test.ts worker/test/kv.test.ts
git commit -m "feat: add D1 and KV services"
```

## Task 1.4: CORS and Rate Limit Middleware

**Files:**

- Create: `worker/src/middleware/cors.ts`
- Create: `worker/src/middleware/rate-limit.ts`
- Create: `worker/test/rate-limit.test.ts`
- Modify: `worker/src/app.ts`

- [ ] **Step 1: Write rate limit tests**

`worker/test/rate-limit.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { checkPendingJobLimit, checkRateLimit } from "../src/middleware/rate-limit";

function mockKv(initialValue: string | null) {
  return {
    get: vi.fn().mockResolvedValue(initialValue),
    put: vi.fn().mockResolvedValue(undefined),
  } as unknown as KVNamespace;
}

function mockDb(count: number) {
  const first = vi.fn().mockResolvedValue({ count });
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  return { prepare } as unknown as D1Database;
}

describe("checkRateLimit", () => {
  it("allows the first 5 requests in a minute bucket", async () => {
    const kv = mockKv("4");
    await expect(checkRateLimit(kv, "sha256:abc", 1700000000000)).resolves.toEqual({
      allowed: true,
      current: 5,
    });
  });

  it("rejects the 6th request in a minute bucket", async () => {
    const kv = mockKv("5");
    await expect(checkRateLimit(kv, "sha256:abc", 1700000000000)).resolves.toEqual({
      allowed: false,
      current: 5,
    });
  });
});

describe("checkPendingJobLimit", () => {
  it("rejects when 100 jobs are queued or processing", async () => {
    await expect(checkPendingJobLimit(mockDb(100))).resolves.toEqual({
      allowed: false,
      current: 100,
    });
  });
});
```

- [ ] **Step 2: Implement rate limit middleware**

`worker/src/middleware/rate-limit.ts`:

```ts
import { createMiddleware } from "hono/factory";
import { getClientIp, hashIp } from "../services/ip";
import type { AppEnv } from "../types";

export async function checkRateLimit(
  kv: KVNamespace,
  ipHash: string,
  nowMs = Date.now(),
) {
  const minuteBucket = Math.floor(nowMs / 60_000);
  const key = `rate:${ipHash}:${minuteBucket}`;
  const current = Number((await kv.get(key)) ?? "0");
  if (current >= 5) return { allowed: false, current };
  await kv.put(key, String(current + 1), { expirationTtl: 120 });
  return { allowed: true, current: current + 1 };
}

export async function checkPendingJobLimit(db: D1Database) {
  const result = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM jobs WHERE status IN ('queued', 'processing')",
    )
    .bind()
    .first<{ count: number }>();
  const current = result?.count ?? 0;
  return { allowed: current < 100, current };
}

export const rateLimitMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const ipHash = await hashIp(getClientIp(c.req.raw), c.env.IP_HASH_SALT);
  const rate = await checkRateLimit(c.env.KV, ipHash);
  if (!rate.allowed) {
    return c.json({ error: "rate_limit_exceeded", limit: 5 }, 429);
  }

  const pending = await checkPendingJobLimit(c.env.DB);
  if (!pending.allowed) {
    return c.json({ error: "system_busy", maxPendingJobs: 100 }, 503);
  }

  await next();
});
```

- [ ] **Step 3: Implement CORS middleware**

`worker/src/middleware/cors.ts`:

```ts
import { cors } from "hono/cors";
import type { AppEnv } from "../types";

export function apiCors() {
  return cors<AppEnv>({
    origin: (origin, c) => {
      const allowed = new Set([c.env.FRONTEND_ORIGIN, c.env.DEV_ORIGIN]);
      return origin && allowed.has(origin) ? origin : c.env.FRONTEND_ORIGIN;
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["content-type", "authorization"],
    maxAge: 86_400,
  });
}
```

- [ ] **Step 4: Wire CORS in the app**

`worker/src/app.ts`:

```ts
import { Hono } from "hono";
import { apiCors } from "./middleware/cors";
import { healthRoute } from "./routes/health";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>().basePath("/api");
app.use("*", apiCors());
app.route("/", healthRoute);

export default app;
```

- [ ] **Step 5: Verify**

Run:

```bash
cd worker
npm test -- rate-limit.test.ts
npm run typecheck
```

Expected: rate-limit tests pass and TypeScript exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add worker/src/middleware worker/src/app.ts worker/test/rate-limit.test.ts
git commit -m "feat: add API CORS and rate limits"
```

## Task 1.5: Extract and Jobs Routes

**Files:**

- Create: `worker/src/routes/extract.ts`
- Create: `worker/src/routes/jobs.ts`
- Modify: `worker/src/index.ts`
- Create: `worker/test/extract-route.test.ts`
- Create: `worker/test/jobs-route.test.ts`

- [ ] **Step 1: Write route tests**

`extract-route.test.ts` should assert:

```ts
it("returns 202 and enqueues first free job", async () => {
  const response = await app.request(
    "/api/extract",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "CF-Connecting-IP": "203.0.113.10",
      },
      body: JSON.stringify({
        url: "https://neon.com",
        email: "user@example.com",
      }),
    },
    mockEnvWithIpCount(0),
  );

  expect(response.status).toBe(202);
  await expect(response.json()).resolves.toMatchObject({ status: "queued" });
});
```

`jobs-route.test.ts` should assert:

```ts
it("returns 404 for missing job", async () => {
  const response = await app.request(
    "/api/jobs/job_missing",
    {},
    mockEnvWithNoJob(),
  );
  expect(response.status).toBe(404);
});
```

- [ ] **Step 2: Implement extract route**

Core route behavior:

```ts
import { Hono } from "hono";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { createJob } from "../services/db";
import { createJobId } from "../services/ids";
import { getClientIp, hashIp } from "../services/ip";
import { getIpUsage, incrementIpUsage } from "../services/kv";
import { extractRequestSchema } from "../services/validation";
import { writeAuditEvent } from "../services/audit";
import type { Env } from "../types";

export const extractRoute = new Hono<{ Bindings: Env }>().post(
  "/extract",
  rateLimitMiddleware,
  async (c) => {
    const body = extractRequestSchema.parse(await c.req.json());
    const ipHash = await hashIp(getClientIp(c.req.raw), c.env.IP_HASH_SALT);
    const usage = await getIpUsage(c.env.KV, ipHash);

    if ((usage?.count ?? 0) >= 1) {
      return c.json(
        { requiresPayment: true, message: "Payment required" },
        402,
      );
    }

    const jobId = createJobId();
    const domain = new URL(body.url).hostname;
    await createJob(c.env.DB, {
      jobId,
      url: body.url,
      domain,
      email: body.email,
      ipHash,
      paid: false,
      orderCode: null,
    });
    await incrementIpUsage(c.env.KV, ipHash);
    await writeAuditEvent(c.env.DB, {
      jobId,
      actorType: "user",
      eventType: "job.queued",
      metadata: { domain },
    });
    await c.env.EXTRACT_QUEUE.send({ jobId, url: body.url, email: body.email });

    return c.json(
      { jobId, status: "queued", pollUrl: `/api/jobs/${jobId}` },
      202,
    );
  },
);
```

- [ ] **Step 3: Implement jobs route**

```ts
import { Hono } from "hono";
import { getJob } from "../services/db";
import type { Env } from "../types";

export const jobsRoute = new Hono<{ Bindings: Env }>().get(
  "/jobs/:jobId",
  async (c) => {
    const job = await getJob(c.env.DB, c.req.param("jobId"));
    if (!job) return c.json({ error: "job_not_found" }, 404);
    return c.json(job);
  },
);
```

- [ ] **Step 4: Wire routes**

`worker/src/app.ts`:

```ts
import { Hono } from "hono";
import { apiCors } from "./middleware/cors";
import { extractRoute } from "./routes/extract";
import { healthRoute } from "./routes/health";
import { jobsRoute } from "./routes/jobs";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>().basePath("/api");
app.use("*", apiCors());
app.route("/", healthRoute);
app.route("/", extractRoute);
app.route("/", jobsRoute);

export default app;
```

- [ ] **Step 5: Verify**

Run:

```bash
cd worker
npm test -- extract-route.test.ts jobs-route.test.ts
npm run typecheck
```

Expected: route tests pass and TypeScript exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add worker/src worker/test/extract-route.test.ts worker/test/jobs-route.test.ts
git commit -m "feat: add extract and job status routes"
```
