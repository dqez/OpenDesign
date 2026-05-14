# OpenDesign Deploy Runbook

## Overview

This runbook deploys OpenDesign after the Cloudflare account resources have been created.
Use it for a fresh production deploy or for repeat deploys after code changes.

Read first:

- `docs/cloudflare-account-setup.md`
- `worker/wrangler.jsonc`
- `worker/r2-cors.json`

## Deployment Order

1. Verify local packages.
2. Deploy or update the extractor container.
3. Apply D1 migrations.
4. Deploy the Worker API.
5. Deploy the Pages frontend.
6. Configure SePay webhook.
7. Run smoke checks.

## 1. Preflight

From repo root:

```powershell
git status --short
node --version
npm --version
```

Install dependencies if needed:

```powershell
cd worker
npm ci

cd ..\container
npm ci

cd ..\frontend
npm ci

cd ..
```

Confirm Wrangler target account:

```powershell
cd worker
npx wrangler whoami
cd ..
```

If this shows the wrong account, stop and run `npx wrangler login` again or set the correct `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`.

## 2. Local Verification

Run the full verification set:

```powershell
cd worker
npm run types
npm test
npm run typecheck
npx wrangler d1 migrations apply opendesign-prod --local
cd ..

cd container
npm test
npm run typecheck
npm run build
cd ..

cd frontend
npm test
npm run build
cd ..
```

Expected result:

- Worker tests pass.
- Worker typecheck passes.
- Local D1 migrations apply.
- Container tests/typecheck/build pass.
- Frontend tests/build pass.

## 3. Deploy Extractor Container

The Worker calls `EXTRACTOR_URL` for extraction. The container must be reachable over HTTPS and must share the same `EXTRACTOR_API_KEY` as the Worker.

### Build Image

```powershell
cd container
docker build -t opendesign-dembrandt:vps .
```

### Run Locally For A Quick Check

Create an env file outside git, for example `E:\secrets\opendesign-extractor.env`:

```dotenv
PORT=8080
EXTRACTOR_API_KEY=replace-with-shared-secret
CF_ACCOUNT_ID=replace-with-cloudflare-account-id
R2_ACCESS_KEY_ID=replace-with-r2-access-key-id
R2_SECRET_ACCESS_KEY=replace-with-r2-secret-access-key
R2_BUCKET_NAME=opendesign-outputs
```

Run:

```powershell
docker rm -f opendesign-extractor
docker run -d --name opendesign-extractor `
  -p 8080:8080 `
  --env-file E:\secrets\opendesign-extractor.env `
  opendesign-dembrandt:vps
```

Check health:

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

### Deploy To VPS

Example Linux VPS flow:

```bash
sudo mkdir -p /opt/opendesign/container
sudo mkdir -p /opt/opendesign/secrets
```

Copy the `container/` directory to `/opt/opendesign/container`, then on the VPS:

```bash
cd /opt/opendesign/container
npm ci
docker build -t opendesign-dembrandt:vps .
```

Create `/opt/opendesign/secrets/extractor.env`:

```dotenv
PORT=8080
EXTRACTOR_API_KEY=replace-with-shared-secret
CF_ACCOUNT_ID=replace-with-cloudflare-account-id
R2_ACCESS_KEY_ID=replace-with-r2-access-key-id
R2_SECRET_ACCESS_KEY=replace-with-r2-secret-access-key
R2_BUCKET_NAME=opendesign-outputs
```

Protect it:

```bash
chmod 600 /opt/opendesign/secrets/extractor.env
```

Run container:

```bash
docker rm -f opendesign-extractor || true
docker run -d --name opendesign-extractor \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file /opt/opendesign/secrets/extractor.env \
  opendesign-dembrandt:vps
```

Expose it through your preferred HTTPS mechanism:

- Cloudflare Tunnel, for example `https://extractor.example.com`.
- Reverse proxy with TLS, for example Caddy or Nginx.
- A managed container host with HTTPS.

After the public URL is ready, update `worker/wrangler.jsonc`:

```jsonc
"EXTRACTOR_URL": "https://extractor.example.com"
```

Then deploy the Worker again.

## 4. Apply D1 Migrations

From `worker/`:

```powershell
cd worker
npx wrangler d1 migrations list opendesign-prod --remote
npx wrangler d1 migrations apply opendesign-prod --remote
```

Verify tables:

```powershell
npx wrangler d1 execute opendesign-prod --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

If migrations fail, do not deploy the Worker until the schema issue is resolved.

## 5. Deploy Worker API

From `worker/`:

```powershell
npm run types
npm run typecheck
npm test
npm run deploy
```

Expected output includes a deployed `workers.dev` URL, usually:

```text
https://opendesign-api.<workers-subdomain>.workers.dev
```

Save this URL as `API_BASE`.

Check health:

```powershell
$api = "https://opendesign-api.<workers-subdomain>.workers.dev"
Invoke-RestMethod "$api/api/health"
```

Expected:

```json
{
  "ok": true,
  "service": "opendesign-api"
}
```

Check logs if needed:

```powershell
npx wrangler tail opendesign-api
```

## 6. Deploy Frontend To Pages

From `frontend/`, build with the deployed Worker URL.

```powershell
cd ..\frontend
$env:VITE_API_BASE = "https://opendesign-api.<workers-subdomain>.workers.dev"
npm test
npm run build
```

Create the Pages project if it does not exist:

```powershell
npx wrangler pages project create opendesign
```

Deploy:

```powershell
npx wrangler pages deploy dist --project-name opendesign --branch main
```

Expected URL:

```text
https://opendesign.pages.dev
```

If the final Pages URL differs, update all of these:

- `worker/wrangler.jsonc` -> `vars.FRONTEND_ORIGIN`
- `worker/r2-cors.json`
- Re-run `npx wrangler r2 bucket cors set opendesign-outputs --file r2-cors.json`
- Re-run `npm run deploy` in `worker`

## 7. Configure SePay Webhook

Use this webhook URL:

```text
https://opendesign-api.<workers-subdomain>.workers.dev/api/sepay/webhook
```

The Worker requires:

```text
Authorization: Apikey <SEPAY_API_KEY>
```

Payloads must include the order code in `code` or `content`.
New OpenDesign orders use:

```text
OD-XXXXXX
```

Legacy `2D-XXXXXX` is still accepted for pending payments created before the rebrand.

If SePay cannot send the required Authorization header directly, put a trusted adapter/proxy in front of the Worker or adjust `worker/src/middleware/sepay-auth.ts` intentionally and retest.

## 8. Production Smoke Tests

Set URLs:

```powershell
$api = "https://opendesign-api.<workers-subdomain>.workers.dev"
$site = "https://opendesign.pages.dev"
```

API health:

```powershell
Invoke-RestMethod "$api/api/health"
```

Design catalog:

```powershell
Invoke-WebRequest "$api/api/designs" -UseBasicParsing
```

Frontend:

```powershell
Invoke-WebRequest "$site" -UseBasicParsing
```

Submit a first free extraction:

```powershell
$body = @{
  url = "https://neon.com"
  email = "tester@example.com"
} | ConvertTo-Json

Invoke-RestMethod "$api/api/extract" -Method Post -ContentType "application/json" -Body $body
```

Expected for a fresh IP:

```json
{
  "jobId": "job_...",
  "status": "queued",
  "pollUrl": "/api/jobs/job_..."
}
```

Poll the returned job:

```powershell
Invoke-RestMethod "$api/api/jobs/<job-id>"
```

Expected status transitions:

- `queued`
- `processing`
- `completed` with signed artifact URLs, or `failed` with a clear `failureReason`

## 9. R2 Verification

After a completed job, list objects in the bucket:

```powershell
npx wrangler r2 object list opendesign-outputs
```

Expected keys look like:

```text
neon.com/job_<id>/tokens.json
neon.com/job_<id>/DESIGN.md
neon.com/job_<id>/brand-guide.pdf
```

If browser downloads fail but object listing works, re-check R2 CORS:

```powershell
cd worker
npx wrangler r2 bucket cors list opendesign-outputs
```

## 10. D1 Verification

Inspect recent jobs:

```powershell
cd worker
npx wrangler d1 execute opendesign-prod --remote --command "SELECT job_id, url, email, status, paid, order_code, failure_reason, created_at FROM jobs ORDER BY created_at DESC LIMIT 10;"
```

Inspect recent orders:

```powershell
npx wrangler d1 execute opendesign-prod --remote --command "SELECT order_code, status, amount, paid_at, expires_at FROM orders ORDER BY created_at DESC LIMIT 10;"
```

Inspect recent webhook events:

```powershell
npx wrangler d1 execute opendesign-prod --remote --command "SELECT provider_event_id, order_code, status, processed_at FROM webhook_events ORDER BY received_at DESC LIMIT 10;"
```

## 11. Common Failures

### Worker deploy says D1 database not found

Cause: `database_id` or account is wrong.

Fix:

```powershell
npx wrangler d1 list
```

Copy the correct ID into `worker/wrangler.jsonc`, then run:

```powershell
npm run types
npm run deploy
```

### R2 upload or presigned URL fails

Check:

- `CF_ACCOUNT_ID` matches the account that owns `opendesign-outputs`.
- R2 S3 token has Object Read & Write for the bucket.
- `R2_BUCKET_NAME` is `opendesign-outputs`.
- Extractor and Worker both have the same R2 credentials.

### Extract jobs fail with `extractor_start_failed`

Check:

- `EXTRACTOR_URL` is public HTTPS and reachable.
- `EXTRACTOR_API_KEY` Worker secret matches extractor env.
- Extractor container is running.
- VPS firewall allows the exposed port or tunnel is active.

### Browser gets CORS errors on downloads

Check:

- `worker/r2-cors.json` includes the actual Pages origin.
- R2 CORS policy was applied with `r2 bucket cors set`.
- The browser request includes an `Origin` header.

### SePay webhook returns 401

Check:

- Request header is exactly `Authorization: Apikey <SEPAY_API_KEY>`.
- The deployed Worker has `SEPAY_API_KEY` secret set.

### Frontend calls the wrong API

Cause: `VITE_API_BASE` was not set at build time.

Fix:

```powershell
cd frontend
$env:VITE_API_BASE = "https://opendesign-api.<workers-subdomain>.workers.dev"
npm run build
npx wrangler pages deploy dist --project-name opendesign --branch main
```

## 12. Rollback

Worker rollback options:

- Use Cloudflare dashboard Deployments to roll back to a previous Worker version.
- Or redeploy the previous git commit:

```powershell
git checkout <previous-good-commit>
cd worker
npm ci
npm run deploy
```

Pages rollback:

- Use Cloudflare Pages deployments UI and promote a previous deployment.
- Or redeploy a previous commit's `frontend/dist`.

Extractor rollback:

```bash
docker rm -f opendesign-extractor
docker run -d --name opendesign-extractor \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file /opt/opendesign/secrets/extractor.env \
  opendesign-dembrandt:<previous-tag>
```

Do not roll back D1 migrations unless you have a tested data rollback plan.

## Final Deployment Checklist

- [ ] Extractor `/health` returns `opendesign-dembrandt-container`.
- [ ] D1 remote migrations applied.
- [ ] Worker `npm test` and `npm run typecheck` pass before deploy.
- [ ] Worker `/api/health` returns `opendesign-api`.
- [ ] Pages build used the production `VITE_API_BASE`.
- [ ] Pages URL is allowed by Worker CORS and R2 CORS.
- [ ] SePay webhook URL and Authorization header are configured.
- [ ] A test extraction can complete and produce R2 objects.
- [ ] Completion email is received and includes `tokens.json`, `DESIGN.md`, and `brand-guide.pdf` links.
