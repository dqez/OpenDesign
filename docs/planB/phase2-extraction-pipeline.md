# Phase 2 Extraction Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect queue messages to a durable extraction workflow and a container contract that runs dembrandt and uploads output files to R2.

**Architecture:** The Worker queue consumer starts `ExtractionWorkflow`. The workflow updates D1, calls the extraction container through the `@cloudflare/containers` Durable Object binding, records R2 object keys, and marks the job completed or failed. The container exposes an internal HTTP `/extract` contract; the Worker-owned `DembrandtContainer` class controls lifecycle and routes container R2 uploads through Worker bindings.

**Tech Stack:** Cloudflare Queues, Cloudflare Workflows, Cloudflare Containers, `@cloudflare/containers`, Node.js child process, dembrandt, Playwright, Vitest.

---

## Task 2.1: Queue Consumer and Workflow Binding

**Files:**

- Create: `worker/src/queue.ts`
- Create: `worker/src/containers/dembrandt.ts`
- Create: `worker/src/workflows/extraction.ts`
- Modify: `worker/src/index.ts`
- Modify: `worker/wrangler.jsonc`

- [ ] **Step 1: Add Workflow binding types**

Extend `worker/src/types.ts`:

```ts
import type { DurableObjectNamespace } from "@cloudflare/workers-types";

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
  DEMBRANDT_CONTAINER: DurableObjectNamespace;
  IP_HASH_SALT: string;
  SEPAY_API_KEY: string;
  RESEND_API_KEY: string;
  SEPAY_BANK_ACCOUNT: string;
  SEPAY_BANK_NAME: string;
  SEPAY_BANK_ACCOUNT_NAME: string;
};
```

- [ ] **Step 2: Implement queue consumer**

`worker/src/queue.ts`:

```ts
import type { Env, ExtractionPayload } from "./types";

export async function handleQueue(
  batch: MessageBatch<ExtractionPayload>,
  env: Env,
) {
  for (const message of batch.messages) {
    await env.EXTRACTION_WORKFLOW.create({ params: message.body });
    message.ack();
  }
}
```

- [ ] **Step 3: Implement Container class**

`worker/src/containers/dembrandt.ts`:

```ts
import { Container } from "@cloudflare/containers";
import type { Env } from "../types";

type OutboundHandler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) => Promise<Response>;

export class DembrandtContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
  enableInternet = true;
  entrypoint = ["npm", "run", "start"];

  static outboundByHost: Record<string, OutboundHandler> = {
    "r2.internal": async (request, env) => {
      const url = new URL(request.url);
      const key = decodeURIComponent(url.pathname.replace(/^\//, ""));
      if (!key) return new Response("missing R2 key", { status: 400 });

      if (request.method === "PUT") {
        await env.R2.put(key, request.body, {
          httpMetadata: {
            contentType:
              request.headers.get("content-type") ?? "application/octet-stream",
          },
        });
        return new Response("ok", { status: 200 });
      }

      return new Response("method not allowed", { status: 405 });
    },
  };

  override onStop(event: { exitCode?: number; reason?: string }) {
    console.log("dembrandt_container_stopped", event);
  }

  override onError(error: unknown) {
    console.error("dembrandt_container_error", error);
    throw error;
  }
}
```

- [ ] **Step 4: Implement workflow shell**

`worker/src/workflows/extraction.ts`:

```ts
import { WorkflowEntrypoint } from "cloudflare:workers";
import { writeAuditEvent } from "../services/audit";
import { updateJobStatus } from "../services/db";
import type { Env, ExtractionPayload } from "../types";

export class ExtractionWorkflow extends WorkflowEntrypoint<
  Env,
  ExtractionPayload
> {
  async run(event: WorkflowEvent<ExtractionPayload>, step: WorkflowStep) {
    const payload = event.payload;
    await step.do("mark-processing", async () => {
      await updateJobStatus(this.env.DB, payload.jobId, "processing");
    });

    await step.do("record-workflow-started", async () => {
      await writeAuditEvent(this.env.DB, {
        jobId: payload.jobId,
        actorType: "system",
        eventType: "workflow.started",
        metadata: { url: payload.url },
      });
    });
  }
}
```

- [ ] **Step 5: Export queue, workflow, and container entrypoints**

`worker/src/index.ts`:

```ts
import { ContainerProxy } from "@cloudflare/containers";
import { DembrandtContainer } from "./containers/dembrandt";
import app from "./app";
import { handleQueue } from "./queue";
import { ExtractionWorkflow } from "./workflows/extraction";
import type { Env, ExtractionPayload } from "./types";

export { ContainerProxy, DembrandtContainer, ExtractionWorkflow };

export default {
  fetch: app.fetch,
  queue: (batch: MessageBatch<ExtractionPayload>, env: Env) =>
    handleQueue(batch, env),
};
```

Move current Hono app creation from `index.ts` to `worker/src/app.ts` so route tests can import `app` directly.

- [ ] **Step 6: Add Workflow and Container bindings**

Add to `worker/wrangler.jsonc`:

```jsonc
{
  "workflows": [
    {
      "name": "extraction-workflow",
      "binding": "EXTRACTION_WORKFLOW",
      "class_name": "ExtractionWorkflow"
    }
  ],
  "containers": [
    {
      "class_name": "DembrandtContainer",
      "image": "./container/Dockerfile",
      "instance_type": "standard-1",
      "max_instances": 2
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "name": "DEMBRANDT_CONTAINER",
        "class_name": "DembrandtContainer"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["DembrandtContainer"]
    }
  ]
}
```

- [ ] **Step 7: Verify**

Run:

```bash
cd worker
npm run typecheck
npm test
```

Expected: TypeScript recognizes queue, workflow, and container exports; existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add worker/src worker/wrangler.jsonc
git commit -m "feat: wire queue workflow and container bindings"
```

## Task 2.2: Container Extract Contract

**Files:**

- Create: `container/src/execute.ts`
- Create: `container/src/r2.ts`
- Modify: `container/src/server.ts`
- Create: `container/test/execute.test.ts`

- [ ] **Step 1: Write execute test**

```ts
import { describe, expect, it } from "vitest";
import { buildOutputKeys } from "../src/execute";

it("builds stable R2 keys for a job", () => {
  expect(buildOutputKeys("neon.com", "job_abc")).toEqual({
    tokens: "neon.com/job_abc/tokens.json",
    designMd: "neon.com/job_abc/DESIGN.md",
    brandGuide: "neon.com/job_abc/brand-guide.pdf",
  });
});
```

- [ ] **Step 2: Implement container execution helpers**

`container/src/execute.ts`:

```ts
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

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
  const workdir = join(tmpdir(), `opendesign-${jobId}`);
  await mkdir(workdir, { recursive: true });

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
  await rm(workdir, { recursive: true, force: true });
  return { domain, files };
}
```

- [ ] **Step 3: Implement Worker-routed R2 upload helper**

`container/src/r2.ts`:

```ts
export async function uploadObject(
  key: string,
  body: Uint8Array,
  contentType: string,
) {
  const response = await fetch(`http://r2.internal/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "content-type": contentType },
    body,
  });
  if (!response.ok) {
    throw new Error(`r2_upload_failed:${response.status}:${key}`);
  }
}
```

- [ ] **Step 4: Add `/extract` route**

`container/src/server.ts`:

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { buildOutputKeys, runDembrandt } from "./execute";
import { healthPayload } from "./health";
import { uploadObject } from "./r2";

const app = new Hono();
app.get("/health", (c) => c.json(healthPayload()));

app.post("/extract", async (c) => {
  const { jobId, url } = await c.req.json<{ jobId: string; url: string }>();
  const result = await runDembrandt(url, jobId);
  const keys = buildOutputKeys(result.domain, jobId);

  await uploadObject(
    keys.tokens,
    result.files.tokens,
    "application/json",
  );
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

  return c.json({ ok: true, domain: result.domain, files: keys });
});

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8080) });
```

- [ ] **Step 5: Verify**

Run:

```bash
cd container
npm test
npm run typecheck
npm run build:image
```

Expected: tests pass, TypeScript exits with code 0, Docker image builds.

- [ ] **Step 6: Commit**

```bash
git add container
git commit -m "feat: add dembrandt extraction container contract"
```

## Task 2.3: Worker Container Client and Workflow Completion

**Files:**

- Create: `worker/src/services/container.ts`
- Create: `worker/src/services/r2.ts`
- Modify: `worker/src/workflows/extraction.ts`
- Create: `worker/test/extraction-workflow.test.ts`
- Create: `worker/test/r2.test.ts`

- [ ] **Step 1: Implement container client**

`worker/src/services/container.ts`:

```ts
import { getContainer } from "@cloudflare/containers";
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

export async function runContainerExtraction(
  env: Env,
  payload: { jobId: string; url: string },
) {
  const container = getContainer(env.DEMBRANDT_CONTAINER, payload.jobId);
  const response = await container.fetch(new Request("http://container/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }));
  if (!response.ok) {
    throw new Error(`container_extract_failed:${response.status}`);
  }
  return response.json<ContainerResult>();
}
```

- [ ] **Step 2: Write signed URL tests**

`worker/test/r2.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildR2ObjectUrl } from "../src/services/r2";

describe("buildR2ObjectUrl", () => {
  it("builds an account-scoped R2 S3 URL", () => {
    expect(
      buildR2ObjectUrl({
        accountId: "abc123",
        bucketName: "opendesign-outputs",
        key: "neon.com/job_abc/tokens.json",
      }),
    ).toBe(
      "https://abc123.r2.cloudflarestorage.com/opendesign-outputs/neon.com/job_abc/tokens.json",
    );
  });
});
```

- [ ] **Step 3: Implement signed URL service**

`worker/src/services/r2.ts`:

```ts
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "../types";

export type R2ObjectUrlInput = {
  accountId: string;
  bucketName: string;
  key: string;
};

export function buildR2ObjectUrl(input: R2ObjectUrlInput) {
  return `https://${input.accountId}.r2.cloudflarestorage.com/${input.bucketName}/${input.key}`;
}

export function createR2S3Client(env: Env) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function createSignedGetUrl(
  env: Env,
  key: string,
  expiresInSeconds = 86_400,
) {
  return getSignedUrl(
    createR2S3Client(env),
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

export async function createSignedFileUrls(
  env: Env,
  files: { tokens: string; designMd: string; brandGuide: string },
) {
  return {
    tokens: await createSignedGetUrl(env, files.tokens),
    designMd: await createSignedGetUrl(env, files.designMd),
    brandGuide: await createSignedGetUrl(env, files.brandGuide),
  };
}
```

- [ ] **Step 4: Update workflow**

```ts
import { runContainerExtraction } from "../services/container";
import { createSignedFileUrls } from "../services/r2";

const result = await step.do(
  "run-extraction",
  {
    retries: { limit: 2, delay: "1 minute", backoff: "exponential" },
    timeout: "6 minutes",
  },
  async () => runContainerExtraction(this.env, {
    jobId: payload.jobId,
    url: payload.url,
  }),
);

const signedUrls = await step.do(
  "generate-signed-download-urls",
  async () => createSignedFileUrls(this.env, result.files),
);

await step.do("mark-completed", async () => {
  await updateJobStatus(this.env.DB, payload.jobId, "completed", {
    r2Keys: result.files,
  });
});
```

Wrap the workflow body in `try/catch`; on catch, call `updateJobStatus(..., "failed", { failureReason: error.message })`, write an audit event, then rethrow so Workflow retry/observability keeps the failure. Keep `signedUrls` as the value passed to the Phase 3 email task; store only R2 keys in D1.

- [ ] **Step 5: Verify**

Run:

```bash
cd worker
npm test -- r2.test.ts extraction-workflow.test.ts
npm run typecheck
```

Expected: signed URL service tests pass; workflow test verifies processing, completed, and failed updates through the container binding.

- [ ] **Step 6: Commit**

```bash
git add worker/src/services/container.ts worker/src/services/r2.ts worker/src/workflows/extraction.ts worker/test/extraction-workflow.test.ts worker/test/r2.test.ts
git commit -m "feat: complete container workflow with signed URLs"
```
