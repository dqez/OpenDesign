# Cloudflare Release Checklist

## Resources

- [ ] D1 database: `2design-prod`
- [ ] D1 preview database configured in `worker/wrangler.jsonc`
- [ ] KV namespace bound as `KV`
- [ ] R2 bucket: `2design-outputs`
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
npx wrangler d1 migrations apply 2design-prod --remote
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
