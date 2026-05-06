# Phase 3 Payment and Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the paid extraction path: generate SePay payment instructions, verify webhook callbacks, create paid jobs, send completion emails, and log all payment/email events in D1.

**Architecture:** Returning users receive `402 Payment Required` with a D1 `orders` record and SePay QR URL. SePay webhook requests must pass the PRD IP whitelist and `Authorization: Apikey {KEY}` auth, then write idempotent `webhook_events` and `payments`, mark orders paid, create the extraction job, and enqueue work. Workflow completion sends 24h signed R2 URLs through Resend and writes `email_logs`; a scheduled cleanup marks stale pending orders as expired.

**Tech Stack:** Hono, D1, Cloudflare Queues, SePay webhook, Resend, Vitest.

---

## Task 3.1: Order and SePay Service

**Files:**

- Modify: `worker/src/services/db.ts`
- Create: `worker/src/services/sepay.ts`
- Create: `worker/test/sepay.test.ts`

- [ ] **Step 1: Write SePay tests**

```ts
import { describe, expect, it } from "vitest";
import {
  buildSePayQrUrl,
  extractOrderCodeFromWebhook,
  isAllowedSePayIp,
  verifySePayAuthorization,
} from "../src/services/sepay";

it("builds QR URL with amount and order code", () => {
  const url = buildSePayQrUrl({
    bankName: "Vietcombank",
    accountNumber: "0123456789",
    amount: 25000,
    orderCode: "2D-A1B2C3",
  });
  expect(url).toContain("amount=25000");
  expect(url).toContain("des=2D-A1B2C3");
});

it("extracts order code from webhook code field first", () => {
  expect(
    extractOrderCodeFromWebhook({ code: "2D-A1B2C3", content: "ignored" }),
  ).toBe("2D-A1B2C3");
});

it("allows only PRD SePay webhook IPs", () => {
  expect(isAllowedSePayIp("172.236.138.20")).toBe(true);
  expect(isAllowedSePayIp("203.0.113.10")).toBe(false);
});

it("accepts Authorization Apikey header", () => {
  expect(verifySePayAuthorization("Apikey secret", "secret")).toBe(true);
  expect(verifySePayAuthorization("Bearer secret", "secret")).toBe(false);
});
```

- [ ] **Step 2: Implement DB order helpers**

Add to `worker/src/services/db.ts`:

```ts
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
```

- [ ] **Step 3: Implement SePay helpers**

`worker/src/services/sepay.ts`:

```ts
export type SePayWebhookPayload = {
  id: number | string;
  code?: string;
  content?: string;
  transferType?: string;
  transferAmount?: number;
  referenceCode?: string;
};

export function buildSePayQrUrl(input: {
  bankName: string;
  accountNumber: string;
  amount: number;
  orderCode: string;
}) {
  const params = new URLSearchParams({
    acc: input.accountNumber,
    bank: input.bankName,
    amount: String(input.amount),
    des: input.orderCode,
  });
  return `https://qr.sepay.vn/img?${params.toString()}`;
}

export function extractOrderCodeFromWebhook(
  payload: Pick<SePayWebhookPayload, "code" | "content">,
) {
  if (payload.code?.startsWith("2D-")) return payload.code;
  return payload.content?.match(/2D-[A-Z0-9]{6}/)?.[0] ?? null;
}

export function verifySePayAuthorization(
  header: string | null,
  apiKey: string,
) {
  return constantTimeEqual(header ?? "", `Apikey ${apiKey}`);
}

export const SEPAY_ALLOWED_IPS = [
  "172.236.138.20",
  "172.233.83.68",
  "171.244.35.2",
  "151.158.108.68",
  "151.158.109.79",
  "103.255.238.139",
];

export function isAllowedSePayIp(ip: string) {
  return SEPAY_ALLOWED_IPS.includes(ip);
}

function constantTimeEqual(a: string, b: string) {
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let index = 0; index < max; index += 1) {
    diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return diff === 0;
}
```

- [ ] **Step 4: Verify**

Run:

```bash
cd worker
npm test -- sepay.test.ts
npm run typecheck
```

Expected: SePay tests pass and TypeScript exits with code 0.

- [ ] **Step 5: Commit**

```bash
git add worker/src/services worker/test/sepay.test.ts
git commit -m "feat: add SePay order helpers"
```

## Task 3.2: Paid Response in Extract Route

**Files:**

- Modify: `worker/src/routes/extract.ts`
- Modify: `worker/test/extract-route.test.ts`

- [ ] **Step 1: Add failing test**

```ts
it("returns payment instructions for returning IP", async () => {
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
    mockEnvWithIpCount(1),
  );

  expect(response.status).toBe(402);
  await expect(response.json()).resolves.toMatchObject({
    requiresPayment: true,
    amount: 25000,
  });
});
```

- [ ] **Step 2: Implement paid branch**

In `extract.ts`, replace the current `402` branch with:

```ts
const orderCode = createOrderCode();
await createOrder(c.env.DB, {
  orderCode,
  url: body.url,
  email: body.email,
  ipHash,
  amount: 25000,
});

return c.json(
  {
    requiresPayment: true,
    message: "Ban da su dung luot mien phi. Chuyen khoan 25.000d de tiep tuc.",
    orderCode,
    amount: 25000,
    bankInfo: {
      bank: c.env.SEPAY_BANK_NAME,
      accountNumber: c.env.SEPAY_BANK_ACCOUNT,
      accountName: c.env.SEPAY_BANK_ACCOUNT_NAME,
      content: orderCode,
    },
    qrUrl: buildSePayQrUrl({
      bankName: c.env.SEPAY_BANK_NAME,
      accountNumber: c.env.SEPAY_BANK_ACCOUNT,
      amount: 25000,
      orderCode,
    }),
  },
  402,
);
```

- [ ] **Step 3: Verify**

Run:

```bash
cd worker
npm test -- extract-route.test.ts
npm run typecheck
```

Expected: extract route tests pass.

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/extract.ts worker/test/extract-route.test.ts
git commit -m "feat: return payment instructions for returning users"
```

## Task 3.3: SePay Webhook Route

**Files:**

- Create: `worker/src/middleware/sepay-auth.ts`
- Create: `worker/src/routes/webhook.ts`
- Modify: `worker/src/app.ts`
- Modify: `worker/src/services/db.ts`
- Create: `worker/test/webhook-route.test.ts`

- [ ] **Step 1: Add DB payment helpers**

Add functions to `db.ts`:

```ts
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
```

- [ ] **Step 2: Implement SePay auth middleware**

`worker/src/middleware/sepay-auth.ts`:

```ts
import { createMiddleware } from "hono/factory";
import { isAllowedSePayIp, verifySePayAuthorization } from "../services/sepay";
import type { AppEnv } from "../types";

export const sepayAuthMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const clientIp =
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "";

  if (!isAllowedSePayIp(clientIp)) {
    return c.json({ success: false, error: "forbidden_ip" }, 403);
  }

  if (
    !verifySePayAuthorization(
      c.req.header("Authorization") ?? null,
      c.env.SEPAY_API_KEY,
    )
  ) {
    return c.json({ success: false, error: "unauthorized" }, 401);
  }

  await next();
});
```

- [ ] **Step 3: Implement webhook route**

`worker/src/routes/webhook.ts`:

```ts
import { Hono } from "hono";
import { sepayAuthMiddleware } from "../middleware/sepay-auth";
import {
  createJob,
  getWebhookEventByProviderEventId,
  getOrderByCode,
  markOrderPaid,
  markWebhookEventProcessed,
  recordPayment,
  recordWebhookEvent,
} from "../services/db";
import { createEventId, createJobId } from "../services/ids";
import {
  extractOrderCodeFromWebhook,
  type SePayWebhookPayload,
} from "../services/sepay";
import type { Env } from "../types";

export const webhookRoute = new Hono<{ Bindings: Env }>().post(
  "/sepay/webhook",
  sepayAuthMiddleware,
  async (c) => {
    const payload = await c.req.json<SePayWebhookPayload>();
    const providerEventId = String(payload.id);
    const existing = await getWebhookEventByProviderEventId(
      c.env.DB,
      providerEventId,
    );
    if (existing) return c.json({ success: true, duplicate: true });

    const orderCode = extractOrderCodeFromWebhook(payload);
    try {
      await recordWebhookEvent(c.env.DB, {
        webhookEventId: createEventId().replace("evt_", "wh_"),
        providerEventId,
        orderCode,
        status: orderCode ? "received" : "ignored",
        rawPayload: payload,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        return c.json({ success: true, duplicate: true });
      }
      throw error;
    }

    if (!orderCode || payload.transferType !== "in") {
      await markWebhookEventProcessed(c.env.DB, providerEventId, "ignored");
      return c.json({ success: true });
    }

    const order = (await getOrderByCode(c.env.DB, orderCode)) as any;
    if (
      !order ||
      order.status !== "pending" ||
      Number(order.amount) !== Number(payload.transferAmount)
    ) {
      await markWebhookEventProcessed(c.env.DB, providerEventId, "ignored");
      return c.json({ success: true });
    }

    await recordPayment(c.env.DB, {
      paymentId: `pay_${payload.id}`,
      orderCode,
      providerTransactionId: providerEventId,
      referenceCode: payload.referenceCode ?? null,
      amount: Number(payload.transferAmount),
      rawPayload: payload,
    });
    await markOrderPaid(c.env.DB, orderCode);
    await markWebhookEventProcessed(c.env.DB, providerEventId, "processed");

    const jobId = createJobId();
    await createJob(c.env.DB, {
      jobId,
      url: order.url,
      domain: new URL(order.url).hostname,
      email: order.email,
      ipHash: order.ip_hash,
      paid: true,
      orderCode,
    });
    await c.env.EXTRACT_QUEUE.send({
      jobId,
      url: order.url,
      email: order.email,
    });
    return c.json({ success: true });
  },
);
```

- [ ] **Step 4: Wire route and verify**

Add `app.route("/", webhookRoute)` to Worker app.

Run:

```bash
cd worker
npm test -- webhook-route.test.ts
npm run typecheck
```

Expected: non-whitelisted IP returns 403, unauthorized webhook returns 401, valid webhook records payment and enqueues a paid job, and duplicate webhook returns 200 without creating a second job.

- [ ] **Step 5: Commit**

```bash
git add worker/src/middleware/sepay-auth.ts worker/src/routes/webhook.ts worker/src/app.ts worker/src/services/db.ts worker/test/webhook-route.test.ts
git commit -m "feat: add SePay webhook processing"
```

## Task 3.4: Resend Email and D1 Email Logs

**Files:**

- Create: `worker/src/services/email.ts`
- Modify: `worker/src/workflows/extraction.ts`
- Create: `worker/test/email.test.ts`

- [ ] **Step 1: Implement email service**

`worker/src/services/email.ts`:

```ts
import { Resend } from "resend";

export async function sendCompletionEmail(input: {
  apiKey: string;
  to: string;
  downloadUrls: { tokens: string; designMd: string; brandGuide: string };
}) {
  const resend = new Resend(input.apiKey);
  return resend.emails.send({
    from: "2Design <no-reply@2design.app>",
    to: input.to,
    subject: "Your 2Design extraction is ready",
    html: [
      "<p>Your extraction is ready. These links expire in 24 hours.</p>",
      "<ul>",
      `<li><a href="${input.downloadUrls.tokens}">tokens.json</a></li>`,
      `<li><a href="${input.downloadUrls.designMd}">DESIGN.md</a></li>`,
      `<li><a href="${input.downloadUrls.brandGuide}">brand-guide.pdf</a></li>`,
      "</ul>",
    ].join(""),
  });
}
```

- [ ] **Step 2: Add email log helper to DB service**

```ts
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
```

- [ ] **Step 3: Call email service in workflow**

After `mark-completed`, add a `send-email` step:

```ts
await step.do("send-email", async () => {
  const existing = await this.env.DB.prepare(
    "SELECT email_log_id FROM email_logs WHERE job_id = ? AND template = ? AND status = ?",
  )
    .bind(payload.jobId, "job-completed", "sent")
    .first();
  if (existing) return;

  const emailResult = await sendCompletionEmail({
    apiKey: this.env.RESEND_API_KEY,
    to: payload.email,
    downloadUrls: signedUrls,
  });
  await recordEmailLog(this.env.DB, {
    emailLogId: crypto.randomUUID(),
    jobId: payload.jobId,
    email: payload.email,
    template: "job-completed",
    providerMessageId: emailResult.data?.id ?? null,
    status: "sent",
  });
});
```

- [ ] **Step 4: Verify**

Run:

```bash
cd worker
npm test -- email.test.ts extraction-workflow.test.ts
npm run typecheck
```

Expected: workflow test verifies email log insertion after completed extraction.

- [ ] **Step 5: Commit**

```bash
git add worker/src/services/email.ts worker/src/services/db.ts worker/src/workflows/extraction.ts worker/test/email.test.ts
git commit -m "feat: send completion emails and log delivery"
```

## Task 3.5: Expire Pending Orders

**Files:**

- Modify: `worker/src/services/db.ts`
- Modify: `worker/src/index.ts`
- Modify: `worker/wrangler.jsonc`
- Create: `worker/test/order-expiry.test.ts`

- [ ] **Step 1: Write expiry test**

`worker/test/order-expiry.test.ts`:

```ts
import { expect, it, vi } from "vitest";
import { expirePendingOrders } from "../src/services/db";

it("marks expired pending orders as expired", async () => {
  const run = vi.fn().mockResolvedValue({ meta: { changes: 2 } });
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  const db = { prepare } as unknown as D1Database;

  await expirePendingOrders(db, "2026-05-06T00:00:00.000Z");

  expect(prepare).toHaveBeenCalledWith(
    expect.stringContaining("UPDATE orders SET status = 'expired'"),
  );
  expect(bind).toHaveBeenCalledWith("2026-05-06T00:00:00.000Z");
  expect(run).toHaveBeenCalled();
});
```

- [ ] **Step 2: Implement expiry helper**

Add to `worker/src/services/db.ts`:

```ts
export async function expirePendingOrders(
  db: D1Database,
  now = new Date().toISOString(),
) {
  return db
    .prepare(
      "UPDATE orders SET status = 'expired' WHERE status = 'pending' AND expires_at < ?",
    )
    .bind(now)
    .run();
}
```

- [ ] **Step 3: Wire scheduled handler**

`worker/src/index.ts`:

```ts
import { DembrandtContainer } from "./containers/dembrandt";
import app from "./app";
import { expirePendingOrders } from "./services/db";
import { handleQueue } from "./queue";
import { ExtractionWorkflow } from "./workflows/extraction";
import type { Env, ExtractionPayload } from "./types";

export { DembrandtContainer, ExtractionWorkflow };

export default {
  fetch: app.fetch,
  queue: (batch: MessageBatch<ExtractionPayload>, env: Env) =>
    handleQueue(batch, env),
  scheduled: async (_event: ScheduledEvent, env: Env) => {
    await expirePendingOrders(env.DB);
  },
};
```

- [ ] **Step 4: Add cron trigger**

Add to `worker/wrangler.jsonc`:

```jsonc
{
  "triggers": {
    "crons": ["*/30 * * * *"]
  }
}
```

- [ ] **Step 5: Verify**

Run:

```bash
cd worker
npm test -- order-expiry.test.ts
npm run typecheck
```

Expected: expiry test passes and TypeScript exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add worker/src/services/db.ts worker/src/index.ts worker/wrangler.jsonc worker/test/order-expiry.test.ts
git commit -m "feat: expire stale payment orders"
```
