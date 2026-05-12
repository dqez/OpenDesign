# Cloudflare Account Setup For OpenDesign

## Overview

This guide prepares a fresh Cloudflare account for an OpenDesign deployment.
Run it once per account/environment before deploying the Worker and frontend.

OpenDesign uses:

- Cloudflare Worker: API, CORS, Queue consumer, scheduled cleanup, Workflow entrypoint.
- Cloudflare Pages: static Vite React frontend.
- Cloudflare D1: long-term jobs, orders, payments, webhook events, email logs, audit logs.
- Cloudflare R2: generated `tokens.json`, `DESIGN.md`, and `brand-guide.pdf`.
- Cloudflare KV: IP usage and rate-limit cache.
- Cloudflare Queues: async extraction jobs.
- Cloudflare Workflows: durable extraction polling and email completion flow.
- External extractor container: Node/Docker service that runs `dembrandt` and uploads to R2.

Important: IDs in `worker/wrangler.jsonc` are account-specific. If you deploy to a new account, create new D1/KV/R2 resources and replace the old IDs before deploy.

## Prerequisites

- Node.js 20+ recommended.
- npm available in PATH.
- Docker installed if you deploy the extractor container yourself.
- Cloudflare account with Workers, Pages, D1, KV, Queues, Workflows, and R2 enabled.
- R2 S3 API token with Object Read & Write access to the OpenDesign bucket.
- Resend API key and verified sender domain for `no-reply@opendesign.dqez.dev` or another approved sender.
- SePay webhook API key and bank account details.
- A public HTTPS endpoint for the extractor service, for example `https://extractor.example.com`.

## Official References

- Wrangler commands: https://developers.cloudflare.com/workers/wrangler/commands/
- Wrangler configuration: https://developers.cloudflare.com/workers/wrangler/configuration/
- Worker secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- D1 Wrangler commands: https://developers.cloudflare.com/d1/wrangler-commands/
- KV namespace setup: https://developers.cloudflare.com/kv/get-started/
- R2 bucket creation: https://developers.cloudflare.com/r2/buckets/create-buckets/
- R2 S3 API tokens: https://developers.cloudflare.com/r2/api/tokens/
- R2 CORS: https://developers.cloudflare.com/r2/buckets/cors/
- Queues Wrangler commands: https://developers.cloudflare.com/queues/reference/wrangler-commands/
- Workflows guide: https://developers.cloudflare.com/workflows/get-started/guide/
- Pages direct upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Pages build environment variables: https://developers.cloudflare.com/pages/configuration/build-configuration/

## 1. Clone And Install

```powershell
git clone <repo-url> opendesign
cd opendesign

cd worker
npm ci

cd ..\frontend
npm ci

cd ..\container
npm ci

cd ..
```

If you use Bash:

```bash
git clone <repo-url> opendesign
cd opendesign
(cd worker && npm ci)
(cd frontend && npm ci)
(cd container && npm ci)
```

## 2. Authenticate Wrangler

Use the target Cloudflare account, not the old `2design` account.

```powershell
cd worker
npx wrangler login
npx wrangler whoami
```

If the login has access to multiple accounts, Wrangler may prompt you to choose an account. For CI, prefer a scoped API token and set:

```powershell
$env:CLOUDFLARE_API_TOKEN = "<cloudflare-api-token>"
$env:CLOUDFLARE_ACCOUNT_ID = "<cloudflare-account-id>"
```

Do not commit API tokens.

## 3. Choose Resource Names

Recommended production names:

| Resource               | Name                  |
| ---------------------- | --------------------- |
| Worker                 | `opendesign-api`      |
| Pages project          | `opendesign`          |
| D1 production database | `opendesign-prod`     |
| D1 preview database    | `opendesign-preview`  |
| KV binding             | `KV`                  |
| R2 bucket              | `opendesign-outputs`  |
| Queue                  | `extraction-queue`    |
| Workflow               | `extraction-workflow` |

The queue and workflow names above match the current `worker/wrangler.jsonc`.
If you need multiple OpenDesign environments in the same account, rename them to environment-specific names such as `opendesign-prod-extraction-queue` and `opendesign-prod-extraction-workflow`, then update `worker/wrangler.jsonc`.

## 4. Create D1 Databases

From `worker/`:

```powershell
npx wrangler d1 create opendesign-prod
npx wrangler d1 create opendesign-preview
```

Copy the generated database IDs into `worker/wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "opendesign-prod",
    "database_id": "<new-opendesign-prod-database-id>",
    "preview_database_id": "<new-opendesign-preview-database-id>",
    "migrations_dir": "migrations",
    "migrations_table": "d1_migrations"
  }
]
```

Apply migrations locally and remotely:

```powershell
npx wrangler d1 migrations apply opendesign-prod --local
npx wrangler d1 migrations apply opendesign-prod --remote
```

Verify remote tables:

```powershell
npx wrangler d1 execute opendesign-prod --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Expected tables include `jobs`, `orders`, `payments`, `webhook_events`, `email_logs`, and `audit_events`.

## 5. Create KV Namespace

From `worker/`:

```powershell
npx wrangler kv namespace create KV
```

Copy the returned ID into `worker/wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "KV",
    "id": "<new-kv-namespace-id>"
  }
]
```

If you want a separate preview namespace, create it separately and add `preview_id`.

## 6. Create R2 Bucket

From `worker/`:

```powershell
npx wrangler r2 bucket create opendesign-outputs
npx wrangler r2 bucket list
```

Apply the repository CORS policy:

```powershell
npx wrangler r2 bucket cors set opendesign-outputs --file r2-cors.json
npx wrangler r2 bucket cors list opendesign-outputs
```

`worker/r2-cors.json` should allow:

- `https://opendesign.pages.dev`
- `http://localhost:5173`

If your Pages project or custom domain differs, update `worker/r2-cors.json` and re-run the CORS command.

## 7. Create R2 S3 API Credentials

The Worker and extractor use the S3-compatible R2 API for presigned URLs and uploads.

In Cloudflare Dashboard:

1. Go to R2 object storage.
2. Open Manage API tokens.
3. Create an Account or User API token.
4. Choose Object Read & Write.
5. Scope it to `opendesign-outputs` if possible.
6. Copy both values immediately:
   - Access Key ID -> `R2_ACCESS_KEY_ID`
   - Secret Access Key -> `R2_SECRET_ACCESS_KEY`

Also note your Cloudflare account ID for `CF_ACCOUNT_ID`.

## 8. Create Queue

From `worker/`:

```powershell
npx wrangler queues create extraction-queue
```

The current config binds the same Worker as producer and consumer:

```jsonc
"queues": {
  "producers": [{ "queue": "extraction-queue", "binding": "EXTRACT_QUEUE" }],
  "consumers": [{ "queue": "extraction-queue", "max_batch_size": 1, "max_batch_timeout": 30 }]
}
```

If you rename the queue, update both producer and consumer entries.

## 9. Workflows

No separate create command is needed for the current setup. The Workflow binding is declared in `worker/wrangler.jsonc` and deployed with the Worker:

```jsonc
"workflows": [
  {
    "binding": "EXTRACTION_WORKFLOW",
    "name": "extraction-workflow",
    "class_name": "ExtractionWorkflow"
  }
]
```

Regenerate Worker types after changing bindings:

```powershell
npm run types
```

## 10. Create Pages Project

You can create the Pages project before or during deploy.

Interactive:

```powershell
npx wrangler pages project create
```

Use project name `opendesign` and production branch `main` unless your team uses another production branch.

Non-interactive if supported by your Wrangler version:

```powershell
npx wrangler pages project create opendesign --production-branch main
```

The site will be served at `https://opendesign.pages.dev` unless the name is unavailable or a custom domain is attached.

## 11. Worker Vars And Secrets

Plain vars currently live in `worker/wrangler.jsonc`:

```jsonc
"vars": {
  "DEV_ORIGIN": "http://localhost:5173",
  "DEV_ORIGINS": "http://localhost:5173,http://127.0.0.1:5173",
  "FRONTEND_ORIGIN": "https://opendesign.pages.dev",
  "R2_BUCKET_NAME": "opendesign-outputs",
  "EXTRACTOR_URL": "https://extractor.dqez.dev",
  "SEPAY_BANK_ACCOUNT": "101877455638",
  "SEPAY_BANK_NAME": "VIETINBANK",
  "SEPAY_BANK_ACCOUNT_NAME": "TRAN DINH QUY"
}
```

Change these before deploy if your Pages URL, extractor URL, or bank details differ.

Set Worker secrets from `worker/`:

```powershell
npx wrangler secret put IP_HASH_SALT
npx wrangler secret put SEPAY_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EXTRACTOR_API_KEY
npx wrangler secret put CF_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

Recommended values:

| Secret                 | Required value                                                       |
| ---------------------- | -------------------------------------------------------------------- |
| `IP_HASH_SALT`         | Random long string for hashing client IPs                            |
| `SEPAY_API_KEY`        | Shared API key expected in SePay webhook `Authorization: Apikey ...` |
| `RESEND_API_KEY`       | Resend API key                                                       |
| `EXTRACTOR_API_KEY`    | Shared bearer token between Worker and extractor                     |
| `CF_ACCOUNT_ID`        | Cloudflare account ID for R2 S3 endpoint                             |
| `R2_ACCESS_KEY_ID`     | R2 S3 Access Key ID                                                  |
| `R2_SECRET_ACCESS_KEY` | R2 S3 Secret Access Key                                              |

## 12. Local Development Secrets

For local Worker development, create `worker/.dev.vars`. Do not commit this file.

```dotenv
IP_HASH_SALT="replace-with-random-string"
SEPAY_API_KEY="replace-with-sepay-webhook-key"
RESEND_API_KEY="replace-with-resend-key"
EXTRACTOR_API_KEY="replace-with-shared-extractor-key"
CF_ACCOUNT_ID="replace-with-cloudflare-account-id"
R2_ACCESS_KEY_ID="replace-with-r2-access-key-id"
R2_SECRET_ACCESS_KEY="replace-with-r2-secret-access-key"
```

For local frontend development:

```powershell
cd frontend
$env:VITE_API_BASE = "http://127.0.0.1:8787"
npm run dev
```

For production frontend build:

```powershell
$env:VITE_API_BASE = "https://opendesign-api.<workers-subdomain>.workers.dev"
```

## 13. Extractor Environment

The extractor container needs these environment variables:

```dotenv
PORT=8080
EXTRACTOR_API_KEY="same-value-as-worker-secret"
CF_ACCOUNT_ID="cloudflare-account-id"
R2_ACCESS_KEY_ID="r2-access-key-id"
R2_SECRET_ACCESS_KEY="r2-secret-access-key"
R2_BUCKET_NAME="opendesign-outputs"
```

Use the same `EXTRACTOR_API_KEY` in both Worker and container.

## Setup Checklist

- [ ] `npx wrangler whoami` shows the target account.
- [ ] `worker/wrangler.jsonc` has new D1 database IDs.
- [ ] `worker/wrangler.jsonc` has new KV namespace ID.
- [ ] R2 bucket `opendesign-outputs` exists.
- [ ] R2 CORS policy is applied.
- [ ] Queue `extraction-queue` exists or config uses your renamed queue.
- [ ] Worker secrets are set.
- [ ] Extractor HTTPS endpoint exists and matches `EXTRACTOR_URL`.
- [ ] Pages project exists or will be created during deploy.
- [ ] Resend sender domain is verified.
- [ ] SePay webhook can send `Authorization: Apikey <SEPAY_API_KEY>`.
