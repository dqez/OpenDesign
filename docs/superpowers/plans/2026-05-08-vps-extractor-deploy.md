# VPS Extractor Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Cloudflare Worker/Pages/D1/KV/R2/Queue/Workflow stack without Cloudflare Containers by temporarily running the dembrandt extractor as an external Docker service on Docker Desktop or a VPS.

**Architecture:** The product workflow remains the same: frontend submits extraction jobs to the Worker, Queue triggers Workflow, Workflow calls an extractor service, extractor runs dembrandt, uploads outputs to R2, Workflow stores R2 keys in D1 and sends email. The temporary difference is that Workflow calls `EXTRACTOR_URL` over HTTPS instead of `getContainer(...)`.

**Tech Stack:** Cloudflare Workers, Wrangler, D1, KV, R2, Queues, Workflows, Vite Pages, Node.js container service, Docker, Cloudflare R2 S3 API.

---

## Current Branch State

Work from:

```powershell
cd E:\opendesign-codex\.worktrees\planb-backend
git status --short --branch
```

Expected branch:

```text
## deloy/vps
```

Important local note: `worker/.dev.vars` is untracked and likely contains secrets. Do not commit it.

---

## Files To Modify

- Modify `worker/src/services/container.ts`: keep the public function name but call the external extractor service via `fetch`.
- Modify `worker/src/types.ts`: remove the Cloudflare Container Durable Object binding from `Env`; add `EXTRACTOR_URL` and `EXTRACTOR_API_KEY`.
- Modify `worker/src/index.ts`: remove `@cloudflare/containers` and `DembrandtContainer` imports/exports.
- Modify `worker/wrangler.jsonc`: remove `containers`, `durable_objects`, and container class `migrations`; add `EXTRACTOR_URL` to `vars`; remove duplicate `_opendesign_*` bindings if Wrangler auto-added them.
- Modify `worker/package.json`: remove `@cloudflare/containers`.
- Modify `container/src/r2.ts`: upload directly to R2 using the S3-compatible API.
- Modify `container/src/server.ts`: require `Authorization: Bearer ${EXTRACTOR_API_KEY}` on `POST /extract`.
- Add tests for Worker external extractor fetch and container R2 upload/auth.
- Regenerate `worker/worker-configuration.d.ts` using `npx wrangler types`.

---

## Task 1: Update Worker To Call External Extractor

**Files:**
- Modify: `worker/src/services/container.ts`
- Test: `worker/test/container-service.test.ts`

- [ ] **Step 1: Add failing Worker service tests**

Create `worker/test/container-service.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { runContainerExtraction } from "../src/services/container";

describe("runContainerExtraction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the configured external extractor with bearer auth", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          domain: "neon.com",
          files: {
            tokens: "neon.com/job_123/tokens.json",
            designMd: "neon.com/job_123/DESIGN.md",
            brandGuide: "neon.com/job_123/brand-guide.pdf",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runContainerExtraction(
      {
        EXTRACTOR_URL: "https://extractor.example.com/",
        EXTRACTOR_API_KEY: "shared-secret",
      } as never,
      { jobId: "job_123", url: "https://neon.com" },
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://extractor.example.com/extract");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "content-type": "application/json",
      authorization: "Bearer shared-secret",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      jobId: "job_123",
      url: "https://neon.com",
    });
    expect(result.files.tokens).toBe("neon.com/job_123/tokens.json");
  });

  it("throws with response body when extractor fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("dembrandt failed", { status: 500 })),
    );

    await expect(
      runContainerExtraction(
        {
          EXTRACTOR_URL: "https://extractor.example.com",
          EXTRACTOR_API_KEY: "shared-secret",
        } as never,
        { jobId: "job_123", url: "https://neon.com" },
      ),
    ).rejects.toThrow("extractor_failed:500:dembrandt failed");
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

```powershell
cd E:\opendesign-codex\.worktrees\planb-backend\worker
npm test -- --run test/container-service.test.ts
```

Expected: fails because current implementation imports `@cloudflare/containers` and calls `getContainer`.

- [ ] **Step 3: Replace `worker/src/services/container.ts`**

```ts
import type { Env } from "../types";

export type ContainerResult = {
  ok: boolean;
  domain: string;
  files: {
    tokens: string;
    designMd: string;
    brandGuide: string;
  };
};

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export async function runContainerExtraction(
  env: Env,
  payload: { jobId: string; url: string },
) {
  const response = await fetch(joinUrl(env.EXTRACTOR_URL, "/extract"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.EXTRACTOR_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`extractor_failed:${response.status}:${errorBody}`);
  }

  return response.json<ContainerResult>();
}
```

- [ ] **Step 4: Run service test**

```powershell
npm test -- --run test/container-service.test.ts
```

Expected: `2 passed`.

- [ ] **Step 5: Commit**

```powershell
git add worker/src/services/container.ts worker/test/container-service.test.ts
git commit -m "feat: call external extractor service"
```

---

## Task 2: Remove Cloudflare Container Bindings From Worker

**Files:**
- Modify: `worker/src/index.ts`
- Modify: `worker/src/types.ts`
- Modify: `worker/wrangler.jsonc`
- Modify: `worker/package.json`
- Modify generated: `worker/package-lock.json`
- Modify generated: `worker/worker-configuration.d.ts`

- [ ] **Step 1: Replace `worker/src/index.ts`**

```ts
import app from "./app";
import { handleQueue } from "./queue";
import { expirePendingOrders } from "./services/db";
import { ExtractionWorkflow } from "./workflows/extraction";
import type { Env, ExtractionPayload } from "./types";

export { ExtractionWorkflow };

export default {
  fetch: app.fetch,
  queue: (batch: MessageBatch<ExtractionPayload>, env: Env) =>
    handleQueue(batch, env),
  scheduled: async (_event: ScheduledEvent, env: Env) => {
    await expirePendingOrders(env.DB);
  },
};
```

- [ ] **Step 2: Replace `worker/src/types.ts`**

```ts
export type ExtractionPayload = {
  jobId: string;
  url: string;
  email: string;
};

export type Env = {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  EXTRACT_QUEUE: Queue<ExtractionPayload>;
  EXTRACTION_WORKFLOW: Workflow<ExtractionPayload>;
  IP_HASH_SALT: string;
  SEPAY_API_KEY: string;
  RESEND_API_KEY: string;
  CF_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  EXTRACTOR_URL: string;
  EXTRACTOR_API_KEY: string;
  FRONTEND_ORIGIN: string;
  DEV_ORIGIN: string;
  SEPAY_BANK_ACCOUNT: string;
  SEPAY_BANK_NAME: string;
  SEPAY_BANK_ACCOUNT_NAME: string;
};

export type AppEnv = { Bindings: Env };
```

- [ ] **Step 3: Clean `worker/wrangler.jsonc`**

Keep exactly one binding for each Cloudflare resource. Remove duplicate auto-created `_opendesign_*` bindings. Remove `containers`, `durable_objects`, and `migrations`.

Resulting shape:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "opendesign-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-05-06",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1
  },
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "3f2dbe68177745adb166e03e0aa02cd0"
    }
  ],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "opendesign-prod",
      "database_id": "3004f0ce-74c0-467a-a55e-0b833dd4c4ed",
      "preview_database_id": "084e9bfc-83d8-479e-bd1e-2df25430fa2c",
      "migrations_dir": "migrations",
      "migrations_table": "d1_migrations"
    }
  ],
  "r2_buckets": [
    {
      "binding": "R2",
      "bucket_name": "opendesign-outputs"
    }
  ],
  "queues": {
    "producers": [
      {
        "queue": "extraction-queue",
        "binding": "EXTRACT_QUEUE"
      }
    ],
    "consumers": [
      {
        "queue": "extraction-queue",
        "max_batch_size": 1,
        "max_batch_timeout": 30
      }
    ]
  },
  "workflows": [
    {
      "binding": "EXTRACTION_WORKFLOW",
      "name": "extraction-workflow",
      "class_name": "ExtractionWorkflow"
    }
  ],
  "triggers": {
    "crons": ["*/30 * * * *"]
  },
  "vars": {
    "DEV_ORIGIN": "http://localhost:5173",
    "FRONTEND_ORIGIN": "https://opendesign.pages.dev",
    "R2_BUCKET_NAME": "opendesign-outputs",
    "EXTRACTOR_URL": "https://extractor.your-domain.com",
    "SEPAY_BANK_ACCOUNT": "101877455638",
    "SEPAY_BANK_NAME": "VIETINBANK",
    "SEPAY_BANK_ACCOUNT_NAME": "TRAN DINH QUY"
  }
}
```

Before deploying, replace `https://extractor.your-domain.com` with the actual VPS or Cloudflare Tunnel HTTPS URL.

- [ ] **Step 4: Remove unused Cloudflare Containers package**

```powershell
cd E:\opendesign-codex\.worktrees\planb-backend\worker
npm uninstall @cloudflare/containers
```

- [ ] **Step 5: Set new Worker secret**

```powershell
npx wrangler secret put EXTRACTOR_API_KEY
```

Use the same value that the VPS extractor service receives in its `EXTRACTOR_API_KEY` environment variable.

- [ ] **Step 6: Regenerate Worker types**

```powershell
npx wrangler types
```

Expected: generated `worker-configuration.d.ts` no longer includes `DEMBRANDT_CONTAINER` and includes `EXTRACTOR_URL`.

- [ ] **Step 7: Run Worker verification**

```powershell
npm test
npm run typecheck
```

Expected: all Worker tests pass and TypeScript exits 0.

- [ ] **Step 8: Commit**

```powershell
git add worker/src/index.ts worker/src/types.ts worker/src/services/container.ts worker/test/container-service.test.ts worker/wrangler.jsonc worker/package.json worker/package-lock.json worker/worker-configuration.d.ts
git commit -m "chore: deploy worker with external extractor"
```

---

## Task 3: Make Extractor Upload Directly To R2

**Files:**
- Modify: `container/src/r2.ts`
- Test: `container/test/r2.test.ts`

- [ ] **Step 1: Add failing R2 upload test**

Create `container/test/r2.test.ts`:

```ts
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadObject } from "../src/r2.js";

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return {
    ...actual,
    S3Client: vi.fn(() => ({ send: sendMock })),
  };
});

describe("uploadObject", () => {
  beforeEach(() => {
    sendMock.mockReset();
    process.env.CF_ACCOUNT_ID = "account123";
    process.env.R2_ACCESS_KEY_ID = "access123";
    process.env.R2_SECRET_ACCESS_KEY = "secret123";
    process.env.R2_BUCKET_NAME = "opendesign-outputs";
  });

  it("uploads an object through the R2 S3 API", async () => {
    sendMock.mockResolvedValue({});

    await uploadObject(
      "neon.com/job_123/tokens.json",
      new Uint8Array([123, 125]),
      "application/json",
    );

    expect(S3Client).toHaveBeenCalledWith({
      region: "auto",
      endpoint: "https://account123.r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: "access123",
        secretAccessKey: "secret123",
      },
    });
    expect(sendMock).toHaveBeenCalledOnce();
    const command = sendMock.mock.calls[0][0] as PutObjectCommand;
    expect(command.input).toMatchObject({
      Bucket: "opendesign-outputs",
      Key: "neon.com/job_123/tokens.json",
      Body: new Uint8Array([123, 125]),
      ContentType: "application/json",
    });
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

```powershell
cd E:\opendesign-codex\.worktrees\planb-backend\container
npm test -- --run test/r2.test.ts
```

Expected: fails because current implementation calls `http://r2.internal`.

- [ ] **Step 3: Replace `container/src/r2.ts`**

```ts
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

function createR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${requiredEnv("CF_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

export async function uploadObject(
  key: string,
  body: Uint8Array,
  contentType: string,
) {
  await createR2Client().send(
    new PutObjectCommand({
      Bucket: requiredEnv("R2_BUCKET_NAME"),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
```

- [ ] **Step 4: Run container tests and typecheck**

```powershell
npm test
npm run typecheck
```

Expected: container tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit**

```powershell
git add container/src/r2.ts container/test/r2.test.ts
git commit -m "feat: upload extractor output directly to r2"
```

---

## Task 4: Secure Extractor HTTP Endpoint

**Files:**
- Modify: `container/src/server.ts`
- Test: `container/test/server-auth.test.ts`

- [ ] **Step 1: Add failing auth tests**

Create `container/test/server-auth.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const runDembrandtMock = vi.fn();
const uploadObjectMock = vi.fn();

vi.mock("../src/execute.js", () => ({
  buildOutputKeys: () => ({
    tokens: "neon.com/job_123/tokens.json",
    designMd: "neon.com/job_123/DESIGN.md",
    brandGuide: "neon.com/job_123/brand-guide.pdf",
  }),
  runDembrandt: runDembrandtMock,
}));

vi.mock("../src/r2.js", () => ({
  uploadObject: uploadObjectMock,
}));

describe("extractor auth", () => {
  it("rejects extract requests without bearer token", async () => {
    process.env.EXTRACTOR_API_KEY = "shared-secret";
    const { app } = await import("../src/server.js");

    const response = await app.request("/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "job_123", url: "https://neon.com" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("accepts extract requests with the correct bearer token", async () => {
    process.env.EXTRACTOR_API_KEY = "shared-secret";
    runDembrandtMock.mockResolvedValue({
      domain: "neon.com",
      files: {
        tokens: new Uint8Array([123, 125]),
        designMd: new Uint8Array([35]),
        brandGuide: new Uint8Array([37]),
      },
    });
    uploadObjectMock.mockResolvedValue(undefined);
    const { app } = await import("../src/server.js");

    const response = await app.request("/extract", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer shared-secret",
      },
      body: JSON.stringify({ jobId: "job_123", url: "https://neon.com" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      domain: "neon.com",
      files: {
        tokens: "neon.com/job_123/tokens.json",
        designMd: "neon.com/job_123/DESIGN.md",
        brandGuide: "neon.com/job_123/brand-guide.pdf",
      },
    });
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

```powershell
cd E:\opendesign-codex\.worktrees\planb-backend\container
npm test -- --run test/server-auth.test.ts
```

Expected: fails because `container/src/server.ts` does not export `app` and does not check auth.

- [ ] **Step 3: Replace `container/src/server.ts`**

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { buildOutputKeys, runDembrandt } from "./execute.js";
import { healthPayload } from "./health.js";
import { uploadObject } from "./r2.js";

export const app = new Hono();

function isAuthorized(header: string | undefined | null) {
  const expected = process.env.EXTRACTOR_API_KEY;
  if (!expected) return false;
  return header === `Bearer ${expected}`;
}

app.get("/health", (c) => c.json(healthPayload()));

app.post("/extract", async (c) => {
  if (!isAuthorized(c.req.header("authorization"))) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const { jobId, url } = await c.req.json<{ jobId: string; url: string }>();
  const result = await runDembrandt(url, jobId);
  const keys = buildOutputKeys(result.domain, jobId);

  await uploadObject(keys.tokens, result.files.tokens, "application/json");
  await uploadObject(
    keys.designMd,
    result.files.designMd,
    "text/markdown; charset=utf-8",
  );
  await uploadObject(keys.brandGuide, result.files.brandGuide, "application/pdf");

  return c.json({ ok: true, domain: result.domain, files: keys });
});

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8080) });
```

- [ ] **Step 4: Run container verification**

```powershell
npm test
npm run typecheck
npm run build
docker build -t opendesign-dembrandt:vps .
```

Expected: tests pass, TypeScript exits 0, Docker image builds.

- [ ] **Step 5: Commit**

```powershell
git add container/src/server.ts container/test/server-auth.test.ts
git commit -m "feat: secure external extractor endpoint"
```

---

## Task 5: Deploy Extractor On Docker Desktop For First End-To-End Test

**Files:**
- No code files.
- Do not commit secrets.

- [ ] **Step 1: Build image**

```powershell
cd E:\opendesign-codex\.worktrees\planb-backend\container
docker build -t opendesign-dembrandt:vps .
```

- [ ] **Step 2: Run image locally**

Set these PowerShell variables with your real values:

```powershell
$ExtractorApiKey = "same-secret-used-in-wrangler-secret"
$CloudflareAccountId = "your-cloudflare-account-id"
$R2AccessKeyId = "your-r2-access-key-id"
$R2SecretAccessKey = "your-r2-secret-access-key"
```

Run:

```powershell
docker rm -f opendesign-extractor
docker run -d --name opendesign-extractor `
  -p 8080:8080 `
  -e EXTRACTOR_API_KEY="$ExtractorApiKey" `
  -e CF_ACCOUNT_ID="$CloudflareAccountId" `
  -e R2_ACCESS_KEY_ID="$R2AccessKeyId" `
  -e R2_SECRET_ACCESS_KEY="$R2SecretAccessKey" `
  -e R2_BUCKET_NAME="opendesign-outputs" `
  opendesign-dembrandt:vps
```

- [ ] **Step 3: Check local health**

```powershell
Invoke-RestMethod "http://127.0.0.1:8080/health"
```

Expected:

```json
{
  "ok": true,
  "service": "opendesign-dembrandt-container"
}
```

- [ ] **Step 4: Expose local Docker with Cloudflare Tunnel**

```powershell
cloudflared tunnel --url http://127.0.0.1:8080
```

Copy the generated HTTPS URL, for example:

```text
https://abc-123.trycloudflare.com
```

- [ ] **Step 5: Configure Worker to call tunnel URL**

Set `worker/wrangler.jsonc`:

```jsonc
"EXTRACTOR_URL": "https://abc-123.trycloudflare.com"
```

Then:

```powershell
cd E:\opendesign-codex\.worktrees\planb-backend\worker
npx wrangler secret put EXTRACTOR_API_KEY
npx wrangler types
npm test
npm run typecheck
npx wrangler deploy
```

- [ ] **Step 6: Commit tunnel URL only if it is stable**

Cloudflare quick tunnels are temporary. If using a temporary `trycloudflare.com` URL, do not commit it as production config. Use it only for manual validation.

---

## Task 6: Deploy Extractor On VPS For Stable Staging

**Files:**
- Optional create: `container/docker-compose.vps.yml`

- [ ] **Step 1: Build and push image or build on VPS**

Simple path: copy repo to VPS and build there:

```bash
cd /opt/opendesign/container
docker build -t opendesign-dembrandt:vps .
```

- [ ] **Step 2: Create VPS env file**

Create `/opt/opendesign/extractor.env` on VPS:

```env
EXTRACTOR_API_KEY=same-secret-used-in-wrangler-secret
CF_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=opendesign-outputs
PORT=8080
```

Lock down permissions:

```bash
chmod 600 /opt/opendesign/extractor.env
```

- [ ] **Step 3: Run extractor**

```bash
docker rm -f opendesign-extractor || true
docker run -d --name opendesign-extractor \
  --restart unless-stopped \
  --env-file /opt/opendesign/extractor.env \
  -p 127.0.0.1:8080:8080 \
  opendesign-dembrandt:vps
```

- [ ] **Step 4: Put HTTPS in front of extractor**

Recommended: use a Cloudflare Tunnel on the VPS so the service is HTTPS and not directly exposed.

```bash
cloudflared tunnel login
cloudflared tunnel create opendesign-extractor
cloudflared tunnel route dns opendesign-extractor extractor.your-domain.com
```

Create `/etc/cloudflared/config.yml`:

```yaml
tunnel: opendesign-extractor
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: extractor.your-domain.com
    service: http://127.0.0.1:8080
  - service: http_status:404
```

Run as service:

```bash
cloudflared service install
systemctl enable --now cloudflared
```

- [ ] **Step 5: Test VPS extractor**

```powershell
Invoke-RestMethod "https://extractor.your-domain.com/health"
```

Expected:

```json
{
  "ok": true,
  "service": "opendesign-dembrandt-container"
}
```

- [ ] **Step 6: Configure Worker**

Set `worker/wrangler.jsonc`:

```jsonc
"EXTRACTOR_URL": "https://extractor.your-domain.com"
```

Deploy Worker:

```powershell
cd E:\opendesign-codex\.worktrees\planb-backend\worker
npx wrangler secret put EXTRACTOR_API_KEY
npx wrangler types
npm test
npm run typecheck
npx wrangler deploy
```

- [ ] **Step 7: Commit stable VPS config**

```powershell
git add worker/wrangler.jsonc worker/worker-configuration.d.ts
git commit -m "chore: point worker to vps extractor"
```

---

## Task 7: Production-Like Acceptance Test

**Files:**
- No code files.

- [ ] **Step 1: Check Worker health**

```powershell
$api = "https://opendesign-api.<your-workers-subdomain>.workers.dev"
Invoke-RestMethod "$api/api/health"
```

Expected: health JSON response with HTTP 200.

- [ ] **Step 2: Submit first free extraction**

```powershell
$body = @{ url = "https://neon.com"; email = "you@example.com" } | ConvertTo-Json
$response = Invoke-WebRequest -Method Post -Uri "$api/api/extract" -ContentType "application/json" -Body $body
$response.StatusCode
$response.Content
```

Expected:

```text
202
```

Response includes `jobId`.

- [ ] **Step 3: Watch Worker logs**

```powershell
cd E:\opendesign-codex\.worktrees\planb-backend\worker
npx wrangler tail opendesign-api
```

Expected: no runtime errors from Queue, Workflow, or extractor call.

- [ ] **Step 4: Watch VPS logs**

```bash
docker logs -f opendesign-extractor
```

Expected: dembrandt starts, completes, and uploads three files.

- [ ] **Step 5: Poll job status**

```powershell
$jobId = "job_from_step_2"
Invoke-RestMethod "$api/api/jobs/$jobId"
```

Expected final success response:

```json
{
  "jobId": "job_from_step_2",
  "status": "completed",
  "files": {
    "tokens": { "url": "https://..." },
    "designMd": { "url": "https://..." },
    "brandGuide": { "url": "https://..." }
  }
}
```

- [ ] **Step 6: Verify D1 remote**

```powershell
npx wrangler d1 execute opendesign-prod --remote --command "SELECT job_id, status, paid, order_code, r2_keys, failure_reason FROM jobs ORDER BY created_at DESC LIMIT 5;"
npx wrangler d1 execute opendesign-prod --remote --command "SELECT job_id, event_type, metadata, created_at FROM audit_events ORDER BY created_at DESC LIMIT 20;"
npx wrangler d1 execute opendesign-prod --remote --command "SELECT job_id, email, status, provider_message_id, sent_at FROM email_logs ORDER BY sent_at DESC LIMIT 5;"
```

Expected:

- `jobs.status = completed`
- `jobs.r2_keys` contains tokens, DESIGN.md, and brand-guide.pdf keys
- `audit_events` includes `job.queued` and `workflow.started`
- `email_logs.status = sent` if `RESEND_API_KEY` is valid

- [ ] **Step 7: Verify R2 files**

Open the three signed URLs returned from `GET /api/jobs/:jobId`. Expected:

- `tokens.json` downloads or renders JSON
- `DESIGN.md` downloads or renders Markdown text
- `brand-guide.pdf` opens as PDF

- [ ] **Step 8: Verify paid flow**

Submit the same body again from the same IP:

```powershell
try {
  Invoke-WebRequest -Method Post -Uri "$api/api/extract" -ContentType "application/json" -Body $body
} catch {
  $_.Exception.Response.StatusCode.value__
  $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
  $reader.ReadToEnd()
}
```

Expected: HTTP `402`, with `orderCode`, `amount: 25000`, and `qrUrl`.

After a real SePay transfer, verify:

```powershell
npx wrangler d1 execute opendesign-prod --remote --command "SELECT order_code, status, paid_at FROM orders ORDER BY created_at DESC LIMIT 5;"
npx wrangler d1 execute opendesign-prod --remote --command "SELECT payment_id, order_code, provider_transaction_id, amount FROM payments ORDER BY received_at DESC LIMIT 5;"
npx wrangler d1 execute opendesign-prod --remote --command "SELECT provider_event_id, order_code, status, processed_at FROM webhook_events ORDER BY received_at DESC LIMIT 5;"
```

Expected:

- order becomes `paid`
- one payment row exists
- webhook event status is `processed`
- a paid job is created and moves to `completed`

---

## Rollback To Cloudflare Containers Later

When the account can use Cloudflare Containers:

1. Restore `@cloudflare/containers` dependency.
2. Restore `worker/src/containers/dembrandt.ts` imports/exports from `worker/src/index.ts`.
3. Restore `DEMBRANDT_CONTAINER` in `Env`.
4. Restore `containers`, `durable_objects`, and container DO migration in `worker/wrangler.jsonc`.
5. Replace `worker/src/services/container.ts` with the previous `getContainer(env.DEMBRANDT_CONTAINER, payload.jobId).fetch(...)` implementation.
6. Regenerate types:

```powershell
cd E:\opendesign-codex\.worktrees\planb-backend\worker
npx wrangler types
npm test
npm run typecheck
npx wrangler deploy
```

---

## Final Verification Checklist

- [ ] `container`: `npm test`, `npm run typecheck`, `npm run build`, `docker build -t opendesign-dembrandt:vps .`
- [ ] `worker`: `npx wrangler types`, `npm test`, `npm run typecheck`
- [ ] Worker deploy succeeds without Cloudflare Container entitlement.
- [ ] Extractor `/health` returns 200 over HTTPS.
- [ ] Worker can call extractor `/extract` with Bearer auth.
- [ ] Extractor uploads three files to R2.
- [ ] Completed job returns signed R2 URLs.
- [ ] Resend email is sent and logged.
- [ ] SePay paid flow creates payment, webhook event, order paid, and paid job.
