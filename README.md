# OpenDesign

OpenDesign turns a submitted website URL into reusable design artifacts:

- `tokens.json`
- `DESIGN.md`
- `brand-guide.pdf`

The project is designed for designers, frontend developers, and agencies who want to extract design tokens and brand documentation from public websites without running the `dembrandt` CLI manually.

## Overview

OpenDesign is split into three independently runnable packages:

| Package | Purpose |
| --- | --- |
| `worker/` | Cloudflare Worker API built with Hono. It handles validation, CORS, rate limiting, D1/KV/R2 access, Queue messages, Workflow orchestration, SePay webhooks, and Resend emails. |
| `container/` | Node + Hono extractor service. It runs `dembrandt` with Playwright, uploads generated artifacts to R2 through the S3-compatible API, and exposes authenticated extraction endpoints. |
| `frontend/` | Vite + React SPA for Cloudflare Pages. It submits extraction requests, displays payment-required QR state, polls jobs/orders, shows the design catalog, and previews completed artifacts. |

Current implementation note: the PRD still describes Cloudflare Containers as the target architecture, but the current code and deploy runbook use an external HTTPS extractor service through `EXTRACTOR_URL`.

## Product Flow

1. User enters a website URL and email in the frontend.
2. Frontend calls `POST /api/extract`.
3. Worker validates the request, checks IP usage and rate limits, then either:
   - creates a free queued job for first use, or
   - returns a SePay QR payment response for paid use.
4. Worker sends extraction work through Cloudflare Queue and Workflow.
5. Extractor service runs `dembrandt`, uploads artifacts to R2, and reports status.
6. Worker stores status in D1, creates signed R2 URLs, and sends completion email.
7. Frontend polls job/order endpoints and displays downloadable results.

## Tech Stack

- Frontend: Vite, React, React Router
- API: Cloudflare Workers, Hono, TypeScript
- Extractor: Node.js, Hono, Docker, Playwright, `dembrandt`
- Storage and data: Cloudflare D1, KV, R2, Queues, Workflows
- Payments: SePay QR bank transfer webhook
- Email: Resend
- Tests: Vitest

## Prerequisites

- Node.js 20+
- npm
- Docker, if you build or run the extractor container image
- Cloudflare account with Workers, Pages, D1, KV, R2, Queues, and Workflows enabled
- Wrangler authentication for the target Cloudflare account
- R2 S3 API credentials with Object Read & Write access
- Resend API key and verified sender domain
- SePay API key and bank account details
- Public HTTPS URL for the extractor service when deploying production

## Install

From the repository root:

```powershell
cd worker
npm ci

cd ..\container
npm ci

cd ..\frontend
npm ci

cd ..
```

## Configure Worker

For local setup, copy the reusable Wrangler template and replace placeholders with values for the target account:

```powershell
cd worker
Copy-Item .\wrangler.example.jsonc .\wrangler.jsonc
```

Important non-secret vars live in `worker/wrangler.jsonc`, including:

- `FRONTEND_ORIGIN`
- `R2_BUCKET_NAME`
- `EXTRACTOR_URL`
- `EMAIL_FROM`
- `ORDER_CODE_PREFIX`
- `PAID_EXTRACTION_AMOUNT`
- `PAYMENT_CURRENCY`
- `SEPAY_BANK_ACCOUNT`
- `SEPAY_BANK_NAME`
- `SEPAY_BANK_ACCOUNT_NAME`

For local Worker secrets, create `worker/.dev.vars`. Do not commit this file.

```dotenv
IP_HASH_SALT="replace-with-random-string"
SEPAY_API_KEY="replace-with-sepay-webhook-key"
RESEND_API_KEY="replace-with-resend-key"
EXTRACTOR_API_KEY="replace-with-shared-extractor-key"
CF_ACCOUNT_ID="replace-with-cloudflare-account-id"
R2_ACCESS_KEY_ID="replace-with-r2-access-key-id"
R2_SECRET_ACCESS_KEY="replace-with-r2-secret-access-key"
```

Apply local D1 migrations from `worker/`:

```powershell
npx wrangler d1 migrations apply opendesign-prod --local
```

For a fresh Cloudflare account, follow the full resource setup guide before production deploy:

- [Cloudflare account setup](docs/cloudflare-account-setup.md)
- [Huong dan cai dat Cloudflare](docs/cloudflare-account-setup.vi.md)

## Run Locally

Use three terminals.

### 1. Start Extractor

Set the extractor environment. The `EXTRACTOR_API_KEY` value must match the Worker secret.

```powershell
cd container
$env:PORT = "8080"
$env:EXTRACTOR_API_KEY = "replace-with-shared-extractor-key"
$env:CF_ACCOUNT_ID = "replace-with-cloudflare-account-id"
$env:R2_ACCESS_KEY_ID = "replace-with-r2-access-key-id"
$env:R2_SECRET_ACCESS_KEY = "replace-with-r2-secret-access-key"
$env:R2_BUCKET_NAME = "opendesign-outputs"
npm run dev
```

Health check:

```powershell
Invoke-RestMethod "http://127.0.0.1:8080/health"
```

Expected service name:

```json
{
  "ok": true,
  "service": "opendesign-dembrandt-container"
}
```

### 2. Start Worker API

Set `EXTRACTOR_URL` in `worker/wrangler.jsonc` to the extractor URL for the environment. For local development:

```jsonc
"EXTRACTOR_URL": "http://127.0.0.1:8080"
```

Then run:

```powershell
cd worker
npm run dev
```

Wrangler normally serves the Worker at:

```text
http://127.0.0.1:8787
```

Health check:

```powershell
Invoke-RestMethod "http://127.0.0.1:8787/api/health"
```

### 3. Start Frontend

```powershell
cd frontend
$env:VITE_API_BASE = "http://127.0.0.1:8787"
npm run dev
```

Vite normally serves the app at:

```text
http://localhost:5173
```

Optional frontend env vars:

- `VITE_APP_NAME`
- `VITE_APP_GLYPH`
- `VITE_STORAGE_PREFIX`

## API Endpoints

Base path: `/api`

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Worker health check. |
| `GET` | `/api/designs` | R2-backed design catalog with signed artifact URLs. |
| `POST` | `/api/extract` | Creates a free extraction job or returns payment details. |
| `GET` | `/api/orders/:orderCode` | Returns payment order status and a job poll URL after payment creates a job. |
| `GET` | `/api/jobs/:jobId` | Returns job status and signed artifact URLs when completed. |
| `POST` | `/api/sepay/webhook` | SePay webhook protected by source IP and `Authorization: Apikey ...`. |

Example extraction request:

```powershell
$body = @{
  url = "https://neon.com"
  email = "tester@example.com"
} | ConvertTo-Json

Invoke-RestMethod "http://127.0.0.1:8787/api/extract" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

## Verification

Run the package-level checks before deploying.

Worker:

```powershell
cd worker
npm run types
npm test
npm run typecheck
npx wrangler d1 migrations apply opendesign-prod --local
cd ..
```

Container:

```powershell
cd container
npm test
npm run typecheck
npm run build
cd ..
```

Frontend:

```powershell
cd frontend
npm test
npm run build
cd ..
```

## Production Deploy

Production deployment is documented in the runbooks:

- [Deploy runbook](docs/opendesign-deploy-runbook.md)
- [Runbook deploy tieng Viet](docs/opendesign-deploy-runbook.vi.md)

Deployment order:

1. Verify local packages.
2. Deploy or update the extractor container.
3. Apply D1 migrations.
4. Deploy the Worker API.
5. Deploy the Pages frontend.
6. Configure the SePay webhook.
7. Run smoke checks.

Worker deploy from `worker/`:

```powershell
npm run types
npm run typecheck
npm test
npm run deploy
```

Frontend deploy to Pages from `frontend/`:

```powershell
$env:VITE_API_BASE = "https://opendesign-api.<workers-subdomain>.workers.dev"
npm test
npm run build
npx wrangler pages deploy dist --project-name opendesign --branch main
```

Extractor Docker image:

```powershell
cd container
docker build -t opendesign-dembrandt:vps .
```

## Data And Storage

- D1 is the long-term source of truth for jobs, orders, payments, webhook events, email logs, and audit events.
- KV is used only for TTL data such as IP usage and rate-limit counters.
- R2 stores generated artifacts under `{domain}/{jobId}/...`.
- Queue and Workflow coordinate asynchronous extraction work.

Expected R2 object keys:

```text
{domain}/{jobId}/tokens.json
{domain}/{jobId}/DESIGN.md
{domain}/{jobId}/brand-guide.pdf
```

## Security Notes

- Never commit `.dev.vars`, `.env`, API keys, R2 credentials, SePay keys, Resend keys, `IP_HASH_SALT`, or private Cloudflare credentials.
- Keep `EXTRACTOR_API_KEY` identical between Worker and extractor.
- Keep SePay webhook authorization as `Authorization: Apikey <SEPAY_API_KEY>`.
- Preserve explicit frontend origins in Worker CORS and R2 CORS.
- Do not store payment reconciliation, job state, or audit history in KV.

## Documentation

Primary project docs:

- [Backend PRD](docs/opendesign-backend-prd-vi.md)
- [Cloudflare account setup](docs/cloudflare-account-setup.md)
- [Huong dan cai dat Cloudflare](docs/cloudflare-account-setup.vi.md)
- [Deploy runbook](docs/opendesign-deploy-runbook.md)
- [Runbook deploy tieng Viet](docs/opendesign-deploy-runbook.vi.md)

