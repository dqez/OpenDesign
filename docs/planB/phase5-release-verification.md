# Phase 5 Release Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the MVP end-to-end locally and prepare safe Cloudflare deployment steps.

**Architecture:** Verification runs from smallest scope to largest: package tests, local Workers/D1, container contract, frontend build, then a smoke test against deployed Cloudflare resources. Production secrets are configured through Wrangler secrets only.

**Tech Stack:** Vitest, TypeScript, Wrangler, Docker, PowerShell, Cloudflare D1/KV/R2/Queues/Workflows/Containers/Pages.

---

## Task 5.1: Local Verification Script

**Files:**

- Create: `scripts/verify-planb.ps1`

- [ ] **Step 1: Create script**

```powershell
$ErrorActionPreference = "Stop"

Push-Location worker
npm run types
npm test
npm run typecheck
npx wrangler d1 migrations apply opendesign-prod --local
Pop-Location

Push-Location container
npm test
npm run typecheck
npm run build:image
Pop-Location

Push-Location frontend
npm test
npm run build
Pop-Location
```

- [ ] **Step 2: Run script**

Run:

```powershell
.\scripts\verify-planb.ps1
```

Expected: all commands exit with code 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-planb.ps1
git commit -m "chore: add Plan B verification script"
```

## Task 5.2: Local API Smoke Test

**Files:**

- Create: `scripts/smoke-worker-local.ps1`

- [ ] **Step 1: Create smoke script**

```powershell
$ErrorActionPreference = "Stop"

$body = @{
  url = "https://neon.com"
  email = "user@example.com"
} | ConvertTo-Json

$response = Invoke-WebRequest -Method Post -Uri "http://127.0.0.1:8787/api/extract" -Body $body -ContentType "application/json"
if ($response.StatusCode -ne 202) {
  throw "Expected 202 from first extract, got $($response.StatusCode)"
}

$json = $response.Content | ConvertFrom-Json
$job = Invoke-WebRequest -Method Get -Uri "http://127.0.0.1:8787/api/jobs/$($json.jobId)"
if ($job.StatusCode -ne 200) {
  throw "Expected 200 from job polling, got $($job.StatusCode)"
}

for ($i = 0; $i -lt 6; $i++) {
  try {
    $rateResponse = Invoke-WebRequest -Method Post -Uri "http://127.0.0.1:8787/api/extract" -Body $body -ContentType "application/json"
  } catch {
    $rateResponse = $_.Exception.Response
  }
}
if ($rateResponse.StatusCode.value__ -ne 429) {
  throw "Expected 429 from 6th request in one minute, got $($rateResponse.StatusCode)"
}
```

- [ ] **Step 2: Verify manually with Wrangler**

Terminal 1:

```bash
cd worker
npm run dev
```

Terminal 2:

```powershell
.\scripts\smoke-worker-local.ps1
```

Expected: first request returns `202`; job polling returns `200`.

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke-worker-local.ps1
git commit -m "test: add local worker smoke test"
```

## Task 5.3: Cloudflare Resource Checklist

**Files:**

- Create: `docs/planB/cloudflare-release-checklist.md`

- [ ] **Step 1: Write checklist**

````md
# Cloudflare Release Checklist

## Resources

- [ ] D1 database: `opendesign-prod`
- [ ] D1 preview database configured in `worker/wrangler.jsonc`
- [ ] KV namespace bound as `KV`
- [ ] R2 bucket: `opendesign-outputs`
- [ ] Queue: `extraction-queue`
- [ ] Workflow binding: `EXTRACTION_WORKFLOW`
- [ ] Durable Object binding: `DEMBRANDT_CONTAINER` class `DembrandtContainer`
- [ ] Container image builds from `container/Dockerfile`
- [ ] Pages project points to `frontend`

## Secrets

- [ ] `wrangler secret put IP_HASH_SALT`
- [ ] `wrangler secret put SEPAY_API_KEY`
- [ ] `wrangler secret put RESEND_API_KEY`
- [ ] `wrangler secret put CF_ACCOUNT_ID`
- [ ] `wrangler secret put R2_ACCESS_KEY_ID`
- [ ] `wrangler secret put R2_SECRET_ACCESS_KEY`

## Remote Commands

```bash
cd worker
npx wrangler d1 migrations apply opendesign-prod --remote
npx wrangler deploy

cd frontend
npm run build
wrangler pages deploy dist
```

## Post-Deploy Smoke

- [ ] `GET /api/health` returns `200`.
- [ ] First extraction returns `202`.
- [ ] 6th extraction request in one minute from same IP returns `429`.
- [ ] Returning extraction returns `402` with QR URL.
- [ ] Webhook from non-whitelisted IP returns `403`.
- [ ] Webhook with wrong `Authorization` returns `401`.
- [ ] Test webhook with sandbox payload writes `webhook_events` and `payments`.
- [ ] Duplicate webhook returns `200` and creates no second job.
- [ ] Pending order older than `expires_at` becomes `expired` after scheduled cleanup.
- [ ] Completed job has R2 keys in D1 and 24h signed URLs in API response.
- [ ] `email_logs` has one `sent` row for completed job.
````

- [ ] **Step 2: Commit**

```bash
git add docs/planB/cloudflare-release-checklist.md
git commit -m "docs: add Cloudflare release checklist"
```

## Task 5.4: PRD Coverage Review

**Files:**

- Create: `docs/planB/prd-coverage.md`

- [ ] **Step 1: Write coverage matrix**

```md
# PRD Coverage Matrix

| PRD Requirement                                        | Covered By                              |
| ------------------------------------------------------ | --------------------------------------- |
| User submits URL and email                             | Phase 1 Task 1.5, Phase 4 Task 4.2      |
| Free first extraction by IP                            | Phase 1 Task 1.5                        |
| Returning user receives payment QR                     | Phase 3 Task 3.2, Phase 4 Task 4.2      |
| SePay webhook confirms payment                         | Phase 3 Task 3.3                        |
| SePay IP whitelist and duplicate webhook handling      | Phase 3 Task 3.3                        |
| Job status polling                                     | Phase 1 Task 1.5, Phase 4 Task 4.3      |
| D1 long-term jobs/orders/payments/webhooks/email/audit | Phase 1 Task 1.1, Phase 3 Tasks 3.1-3.5 |
| KV short-term IP usage/rate limit                      | Phase 1 Tasks 1.3 and 1.4               |
| Queue and Workflow orchestration                       | Phase 2 Task 2.1, Phase 2 Task 2.3      |
| Container runs dembrandt                               | Phase 2 Task 2.2                        |
| R2 stores tokens, DESIGN.md, PDF                       | Phase 2 Task 2.2, Phase 2 Task 2.3      |
| R2 signed URLs expire after 24h                        | Phase 2 Task 2.3, Phase 3 Task 3.4      |
| CORS for Pages frontend                                | Phase 1 Task 1.4                        |
| Pending order expiry                                   | Phase 3 Task 3.5                        |
| Completion email                                       | Phase 3 Task 3.4                        |
| Frontend preview and downloads                         | Phase 4 Tasks 4.3 and 4.4               |
| Release verification                                   | Phase 5 Tasks 5.1-5.3                   |
```

- [ ] **Step 2: Commit**

```bash
git add docs/planB/prd-coverage.md
git commit -m "docs: map Plan B tasks to PRD coverage"
```

### SePay Hardening Verification

- [ ] Lowercase webhook content such as `od-a1b2c3` matches order `OD-A1B2C3`.
- [ ] Overpayment marks the order paid and creates exactly one job.
- [ ] Underpayment does not create a job.
- [ ] Duplicate processed webhook returns `200` and creates no second job.
- [ ] Existing `received` webhook can resume and create the paid job.
- [ ] Webhook with mismatched `accountNumber` is ignored.
- [ ] Returning user receives the same active pending order while it is unexpired.
- [ ] Frontend navigates from QR state to job status after payment creates `job_id`.
