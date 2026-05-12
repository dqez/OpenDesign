# AGENT.md

## Project

OpenDesign is a Cloudflare-native service for extracting design tokens and brand guide assets from a submitted website URL.

The backend wraps the `dembrandt` CLI so users can submit a URL and email from the frontend, receive a queued extraction job, and download generated artifacts without installing local tooling.

Core outputs:

- `tokens.json`
- `DESIGN.md`
- `brand-guide.pdf`

Primary success targets from the PRD:

- Job completion rate at least 90%.
- P95 processing time no more than 5 minutes.
- R2 upload success at least 99%.
- Completion email success at least 95%.

## Source Of Truth

Read these before implementation:

- `opendesign-backend-prd-vi.md`: product and technical requirements.
- `docs/planB/README.md`: implementation strategy and mandatory fixes.
- `docs/planB/phase*.md`: task-level execution plans.

Conflict order:

1. Current user instruction.
2. `docs/planB/README.md` mandatory patch summary and execution rules.
3. Phase plan for the active task.
4. `opendesign-backend-prd-vi.md`.
5. Existing code patterns.

## Architecture

Use the Plan B vertical-slice architecture:

- `worker/`: Cloudflare Worker API, queue consumer, workflow entrypoints, D1/KV/R2 services, SePay webhook, Resend email.
- `container/`: Cloudflare Container image that runs `dembrandt`, Playwright, and upload/presign helpers.
- `frontend/`: Vite React SPA for URL submission, payment QR, status polling, PDF preview, token preview, and downloads.
- `docs/planB/`: implementation plan and phase checklists.

Cloudflare services:

- D1 is the long-term source of truth for jobs, orders, payments, webhook events, email logs, and audit events.
- KV is only for short-lived IP usage, rate-limit counters, and disposable cache with TTL.
- R2 stores extraction artifacts under `{domain}/{jobId}/...`.
- Queues decouple API requests from extraction work.
- Workflows orchestrate status changes, container execution, retries, R2 result handling, and email delivery.
- Containers run `dembrandt` and Playwright. Do not expose an ad-hoc public container API.

## Non-Negotiable Constraints

- Do not store secrets, API keys, bank credentials, or raw private credentials in D1, KV, R2, source files, or committed config.
- Hash IP addresses with `IP_HASH_SALT` before persistence or KV use.
- Do not use KV for payment reconciliation, job state, audit history, or other long-term records.
- Do not add wildcard CORS to SePay webhook routes.
- Verify SePay webhooks with the PRD IP whitelist and `Authorization: Apikey {KEY}`.
- Make webhook handling idempotent using provider transaction/event IDs.
- Validate URLs strictly and never interpolate untrusted input into shell commands.
- Generate 24-hour signed R2 URLs for job status responses and completion emails.
- Keep output files available for at least 7 days.
- Keep pending job pressure bounded; Plan B uses a cap of 100 queued or processing jobs.
- Rate limit API requests at 5 requests per minute per IP hash.
- Returning users, identified by IP usage count of at least 1, must receive a `402 Payment Required` payment response before another extraction job is queued.

## Container Rule

Use Cloudflare Containers through the Durable Object-backed container binding.

Expected direction:

- Use `@cloudflare/containers`.
- Implement `DembrandtContainer extends Container`.
- Invoke via the Worker binding, for example with `getContainer(env.DEMBRANDT_CONTAINER, jobId).fetch(...)`.

Do not introduce `CONTAINER_ENDPOINT` or public HTTP calls from the Worker to the extraction container unless the user explicitly changes the architecture.

## Data Model

Core D1 tables:

- `jobs`
- `orders`
- `payments`
- `webhook_events`
- `email_logs`
- `audit_events`

Recommended indexes from the PRD:

- `jobs(status, created_at)`
- `jobs(email)`
- `jobs(domain)`
- `orders(order_code)` unique
- `orders(status, expires_at)`
- `payments(provider, provider_transaction_id)` unique
- `webhook_events(provider, provider_event_id)` unique
- `email_logs(job_id, status)`
- `audit_events(job_id, created_at)`

Use D1 prepared statements with bound values. Keep timestamps in ISO string form unless the existing schema establishes another convention.

## API Contract

Base path: `/api`

Required endpoints:

- `POST /api/extract`
  - Request: `{ "url": "https://example.com", "email": "user@example.com" }`
  - First free use: return `202` with `{ jobId, status: "queued", pollUrl }`.
  - Returning user: return `402` with payment details, `orderCode`, `amount: 25000`, bank info, and SePay QR URL.

- `GET /api/jobs/:jobId`
  - Missing job: return `404`.
  - Queued/processing: return current status.
  - Completed: include signed URLs for `tokens`, `designMd`, and `brandGuide`.
  - Failed: include failure reason.

- `POST /api/sepay/webhook`
  - No public CORS.
  - Verify source IP and API key.
  - Deduplicate provider event/transaction IDs.
  - Match order code and amount.
  - Mark order paid, create job, enqueue extraction, and write payment/webhook/audit records.

## Implementation Workflow

Follow the Plan B phase files in order unless the user asks for a different task:

1. Phase 0: repo foundation.
2. Phase 1: Worker data core.
3. Phase 2: extraction pipeline.
4. Phase 3: payment and email.
5. Phase 4: frontend.
6. Phase 5: release verification.

When executing a phase:

- Work one checklist task at a time.
- Use TDD for service, route, webhook, and pipeline behavior.
- Keep each package independently runnable and testable.
- Prefer existing plan file paths and names over inventing alternatives.
- Update generated Worker binding types after `wrangler.jsonc` binding changes.
- Commit only when the task leaves the repo in a verified state, unless the current user/session instruction says not to commit.

## Verification

Run the narrowest relevant checks while developing, then the package-level checks before claiming completion.

Worker:

```bash
cd worker
npm test
npm run typecheck
npx wrangler d1 migrations apply opendesign-prod --local
```

Container:

```bash
cd container
npm test
npm run typecheck
npm run build
npm run build:image
```

Frontend:

```bash
cd frontend
npm test
npm run build
```

End-to-end smoke targets:

- First extraction from a new IP returns `202`.
- Sixth request in one minute returns `429`.
- Returning extraction request returns `402`.
- Duplicate SePay webhook returns `200` without creating a second job.
- Completed job returns 24-hour signed URLs.
- Completion email attempt writes an `email_logs` row.

## Cloudflare Guidance

Cloudflare APIs, Wrangler config, product limits, and pricing can change. Before implementing or deploying Cloudflare-specific behavior, verify current documentation, local package types, and Wrangler schema instead of relying only on memory or the PRD.

Prefer local verification before remote Cloudflare commands. Use remote deployment commands only when credentials and resource IDs are configured intentionally.

## Frontend Guidance

The first screen should be the usable extraction flow, not a marketing landing page.

Required user-facing states:

- URL and email submission.
- Queued/processing status polling.
- Payment-required QR state.
- Completed PDF preview and download actions.
- Failed job state with a clear reason.

Keep the UI practical and work-focused. Avoid decorative layouts that hide the primary extraction workflow.

## Security And Privacy

- Treat email addresses, IP hashes, payment metadata, and extraction results as sensitive operational data.
- Store only the metadata needed for support, reconciliation, and audit.
- Keep raw provider webhook payloads only where required by the PRD and never include secrets.
- Do not log secrets.
- Keep audit events append-only where possible.

