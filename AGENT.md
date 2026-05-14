# AGENT.md

## Project

OpenDesign turns a submitted website URL into reusable design artifacts:

- `tokens.json`
- `DESIGN.md`
- `brand-guide.pdf`

The app is split into three independently runnable packages:

- `worker/`: Cloudflare Worker API built with Hono. It owns request validation, CORS, rate limiting, D1/KV/R2 services, Queue consumption, Workflow orchestration, SePay webhook handling, and Resend completion email.
- `container/`: Node + Hono HTTP extractor service. It runs `dembrandt` with Playwright, uploads artifacts to R2 through the S3-compatible API, and exposes authenticated extraction status endpoints.
- `frontend/`: Vite + React SPA deployed to Cloudflare Pages. It submits URL/email extraction requests, handles payment-required QR state, polls jobs/orders, shows the design catalog, and previews completed artifacts.

## Source Of Truth

Read these before implementation:

- `docs/opendesign-backend-prd-vi.md`: product requirements and target Cloudflare architecture.
- `docs/cloudflare-account-setup.md` and `docs/cloudflare-account-setup.vi.md`: account/resource setup.
- `docs/opendesign-deploy-runbook.md` and `docs/opendesign-deploy-runbook.vi.md`: current deployment flow.
- Current code and tests in the package you are changing.

Conflict order:

1. Current user instruction.
2. This file.
3. Current code, tests, Wrangler config, and deploy runbook.
4. PRD/product docs.
5. General preferences.

The PRD still references Cloudflare Containers as the target architecture, but the current deploy runbook and code use an external HTTPS extractor service through `EXTRACTOR_URL`. Do not perform an architecture migration unless the user explicitly asks for it.

## Current Architecture

Worker API:

- Entry point: `worker/src/index.ts`.
- Hono app: `worker/src/app.ts`, mounted at `/api`.
- Routes live in `worker/src/routes/`.
- Shared services live in `worker/src/services/`.
- Middleware lives in `worker/src/middleware/`.
- Workflow orchestration lives in `worker/src/workflows/extraction.ts`.
- Queue handling lives in `worker/src/queue.ts`.
- Bindings and vars are declared in local `worker/wrangler.jsonc`; generated `worker/worker-configuration.d.ts` is local-only and ignored because it can contain account-specific values.

Extractor service:

- HTTP server: `container/src/server.ts`.
- Job state: `container/src/jobs.ts`, currently in-memory per process.
- `dembrandt` execution: `container/src/execute.ts`.
- R2 upload: `container/src/r2.ts`.
- Docker image: `container/Dockerfile`.

Frontend:

- Routes: `frontend/src/App.tsx`.
- API client: `frontend/src/api.ts`.
- Main pages: `frontend/src/pages/`.
- Reusable UI: `frontend/src/components/`.
- Styling: `frontend/src/styles.css` plus files under `frontend/src/styles/`.
- Public catalog/artifact helpers: `frontend/src/design-artifacts.ts` and `frontend/src/design-token-parser.ts`.

## API Contract

Base path: `/api`.

- `GET /api/health`: service health.
- `GET /api/designs`: R2-backed design catalog with signed artifact URLs.
- `POST /api/extract`: accepts `{ "url": "https://example.com", "email": "user@example.com" }`.
  - First free use returns `202` with `{ jobId, status: "queued", pollUrl }`.
  - Returning IP usage returns `402` with payment details, `orderCode`, `amount`, `currency`, bank info, QR URL, and order status URL.
- `GET /api/orders/:orderCode`: returns payment order status and `pollUrl` after a job exists.
- `GET /api/jobs/:jobId`: returns job status; completed jobs include signed URLs for `tokens`, `designMd`, and `brandGuide`.
- `POST /api/sepay/webhook`: SePay webhook route protected by source IP and `Authorization: Apikey ...`.

## Data And Storage Rules

- D1 is the long-term source of truth for `jobs`, `orders`, `payments`, `webhook_events`, `email_logs`, and `audit_events`.
- KV is only for TTL data: IP usage and rate-limit counters.
- R2 stores generated artifacts under `{domain}/{jobId}/...`.
- Use D1 prepared statements with bound values.
- Store timestamps as ISO strings unless the existing schema establishes another convention.
- Keep webhook handling idempotent by provider event/transaction IDs.
- Keep pending job pressure bounded at the current limit of 100 queued or processing jobs.
- Keep API rate limiting at 5 requests per minute per IP hash unless the requirement changes.

## Security And Privacy

- Never commit API keys, R2 credentials, SePay API keys, Resend API keys, `IP_HASH_SALT`, `.dev.vars`, `.env`, or raw private credentials.
- Hash IP addresses with `IP_HASH_SALT` before persistence or KV use.
- Do not use KV for payment reconciliation, job state, audit history, or other long-term records.
- Do not add wildcard CORS. Preserve explicit frontend/dev origins and keep SePay webhook access controlled.
- Validate URLs strictly and never interpolate untrusted input into shell commands.
- Treat email addresses, IP hashes, payment metadata, webhook payloads, and extraction outputs as sensitive operational data.
- Do not log secrets.

## Implementation Workflow

- Make surgical changes. Touch only files that directly support the task.
- Match existing package style: TypeScript ESM, Hono route modules, service helpers, and Vitest tests.
- Use TDD for Worker services/routes/middleware/workflows and extractor behavior.
- Add or update focused tests next to the package behavior being changed.
- If `worker/wrangler.jsonc` bindings or vars change, run `npm run types` in `worker/` to validate the local config, but do not commit generated account-specific types.
- Keep each package independently installable, testable, and buildable.
- If changing English/Vietnamese deployment docs, update both language versions unless the user asks for only one.
- Do not make remote Cloudflare changes unless credentials/resource IDs are intentionally configured and the user asked for deploy/setup work.

## Verification

Run the narrowest relevant check while developing, then the package-level check before claiming completion.

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

## Frontend Guidance

- Preserve the usable extraction flow as the primary screen.
- Keep route paths stable unless the task explicitly changes navigation.
- Preserve submission, payment polling, job polling, and artifact download behavior.
- Avoid adding a separate marketing-only landing page.
- Preserve the current specimen-lab feel, practical artifact preview, and avoid generic AI gradient treatment.

## Cloudflare Guidance

Cloudflare APIs, Wrangler config, product limits, and pricing can change. Before implementing Cloudflare-specific behavior or deployment steps, verify current official docs, local package types, and the active Wrangler schema instead of relying only on memory or the PRD.

Prefer local verification before remote commands. Use remote deployment commands only when the target account and credentials are deliberate.
