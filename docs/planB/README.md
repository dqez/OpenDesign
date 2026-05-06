# 2Design Backend Plan B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Cloudflare-native 2Design backend from `2design-backend-prd-vi.md` v2.2, including extraction jobs, D1 long-term records, R2 output storage, SePay payments, Resend email, and a Vite frontend.

**Architecture:** Plan B uses vertical slices. Each phase produces a runnable, testable system state before the next phase adds another integration. D1 is the source of truth for jobs, orders, payments, webhooks, email logs, and audit events; KV is only used for short-lived IP usage and rate-limit counters; R2 stores generated files. Cloudflare Containers are invoked through the `@cloudflare/containers` Container class and Durable Object binding, not through an ad-hoc public HTTP endpoint.

**Tech Stack:** Cloudflare Workers, Hono, TypeScript, D1, KV, R2, Queues, Workflows, Cloudflare Containers, `@cloudflare/containers`, Node.js 20, dembrandt, Playwright, AWS SDK R2 presigning, Resend, SePay, Vite, React, Vitest, Wrangler.

---

## Scope Check

The PRD covers several subsystems: Worker API, data layer, queue/workflow orchestration, containerized extraction, payment, email, frontend, and deployment. Plan B keeps them in one release plan but splits them into independently verifiable phases so each phase can be implemented and tested without relying on unfinished UI or external production credentials.

## Mandatory Patch Summary

These fixes are part of Plan B, not optional errata:

| Gap | Required fix | Primary phase |
| --- | --- | --- |
| Container architecture | Use `@cloudflare/containers`, `DembrandtContainer extends Container`, and `getContainer(env.DEMBRANDT_CONTAINER, jobId).fetch(...)` | Phase 2 |
| Rate limiting | Add KV per-minute middleware: 5 requests/minute/IP plus D1 pending job cap of 100 | Phase 1 |
| R2 signed URLs | Generate 24h presigned GET URLs for `GET /api/jobs/:id` and completion emails | Phase 2, Phase 3 |
| CORS | Add Hono CORS middleware for Pages origin and localhost; do not apply permissive CORS to SePay webhook | Phase 1 |
| Order expiry | Add scheduled cleanup that marks stale pending orders as `expired` | Phase 3 |
| Frontend preview | Render token categories, PDF iframe, and download actions instead of only raw links | Phase 4 |
| SePay hardening | Enforce PRD IP whitelist, API key auth, duplicate webhook idempotency, and amount/order matching | Phase 3 |
| Worker consistency | Use `worker/` everywhere, generate Wrangler types, enable `nodejs_compat`, and enable observability | Phase 0, Phase 1 |

## Phase Index

| Phase | File                                                               | Outcome                                                                                   |
| ----- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 0     | [phase0-repo-foundation.md](./phase0-repo-foundation.md)           | Repo has Worker, Container, and Frontend project skeletons.                               |
| 1     | [phase1-worker-data-core.md](./phase1-worker-data-core.md)         | Worker can create jobs, persist D1 records, track IP usage, and return job status.        |
| 2     | [phase2-extraction-pipeline.md](./phase2-extraction-pipeline.md)   | Queue and Workflow can run extraction through the container contract and store R2 keys.   |
| 3     | [phase3-payment-email.md](./phase3-payment-email.md)               | Paid extraction flow, SePay webhook, and completion email logging work.                   |
| 4     | [phase4-frontend.md](./phase4-frontend.md)                         | Vite SPA supports submit, payment QR, status polling, and result preview.                 |
| 5     | [phase5-release-verification.md](./phase5-release-verification.md) | Local and remote verification, deployment checklist, and operational checks are complete. |

## Planned File Structure

```text
2design/
|-- worker/
|   |-- src/
|   |   |-- app.ts
|   |   |-- index.ts
|   |   |-- containers/
|   |   |   `-- dembrandt.ts
|   |   |-- middleware/
|   |   |   |-- cors.ts
|   |   |   |-- rate-limit.ts
|   |   |   `-- sepay-auth.ts
|   |   |-- routes/
|   |   |   |-- extract.ts
|   |   |   |-- health.ts
|   |   |   |-- jobs.ts
|   |   |   `-- webhook.ts
|   |   |-- services/
|   |   |   |-- audit.ts
|   |   |   |-- db.ts
|   |   |   |-- email.ts
|   |   |   |-- ids.ts
|   |   |   |-- ip.ts
|   |   |   |-- kv.ts
|   |   |   |-- r2.ts
|   |   |   |-- sepay.ts
|   |   |   `-- validation.ts
|   |   |-- workflows/
|   |   |   `-- extraction.ts
|   |   |-- queue.ts
|   |   `-- types.ts
|   |-- migrations/
|   |   `-- 0001_init_core_tables.sql
|   |-- test/
|   |   |-- db.test.ts
|   |   |-- extract-route.test.ts
|   |   |-- jobs-route.test.ts
|   |   |-- kv.test.ts
|   |   |-- rate-limit.test.ts
|   |   |-- r2.test.ts
|   |   |-- sepay.test.ts
|   |   `-- webhook-route.test.ts
|   |-- package.json
|   |-- tsconfig.json
|   |-- vitest.config.ts
|   `-- wrangler.jsonc
|-- container/
|   |-- src/
|   |   |-- execute.ts
|   |   |-- health.ts
|   |   |-- r2.ts
|   |   `-- server.ts
|   |-- test/
|   |   `-- execute.test.ts
|   |-- Dockerfile
|   |-- package.json
|   `-- tsconfig.json
|-- frontend/
|   |-- src/
|   |   |-- api.ts
|   |   |-- App.tsx
|   |   |-- main.tsx
|   |   |-- pages/
|   |   |   |-- Home.tsx
|   |   |   |-- Preview.tsx
|   |   |   `-- Status.tsx
|   |   `-- styles.css
|   |-- package.json
|   |-- tsconfig.json
|   `-- vite.config.ts
`-- docs/
    `-- planB/
```

## Execution Rules

- Use TDD for service and route behavior: write the test, run it failing, implement, run it passing.
- Commit after each task that leaves the repo in a verified state.
- Do not store API keys, bank secrets, or raw credentials in D1, KV, R2, or committed config.
- Keep D1 records long-lived for support and reconciliation. Keep KV data short-lived and disposable.
- Prefer local verification before any remote Cloudflare command.
- Run `npx wrangler types` after binding/config changes. Treat generated types as the source of truth for Worker bindings.
- Do not use `CONTAINER_ENDPOINT` or public HTTP to call the extraction container. The Worker must call the Container Durable Object binding.
- Keep webhook routes private to provider authentication logic; never add wildcard CORS to payment webhooks.

## Cross-Phase Done Criteria

- `worker`: `npm test`, `npm run typecheck`, and `npx wrangler d1 migrations apply 2design-prod --local` pass.
- `container`: `npm test`, `npm run typecheck`, and Docker build pass.
- `frontend`: `npm test`, `npm run build`, and manual submit/status/preview smoke tests pass.
- End-to-end smoke: free first extraction returns `202`, 6th request/minute returns `429`, returning extraction returns `402`, duplicate webhook returns `200` without creating a second job, completed job exposes 24h signed URLs, and email logs are written to D1.

## PRD Coverage Matrix

| PRD Requirement                                                           | Plan B Coverage                         |
| ------------------------------------------------------------------------- | --------------------------------------- |
| User submits URL and email                                                | Phase 1 Task 1.5, Phase 4 Task 4.2      |
| Free first extraction by IP                                               | Phase 1 Tasks 1.3 and 1.5               |
| Returning user receives payment QR                                        | Phase 3 Tasks 3.1-3.2, Phase 4 Task 4.2 |
| SePay webhook confirms payment                                            | Phase 3 Task 3.3                        |
| SePay webhook IP whitelist and idempotency                                | Phase 3 Task 3.3                        |
| Job status polling                                                        | Phase 1 Task 1.5, Phase 4 Task 4.3      |
| D1 long-term jobs, orders, payments, webhooks, email logs, and audit logs | Phase 1 Task 1.1, Phase 3 Tasks 3.1-3.4 |
| KV short-term IP usage and rate limit storage                             | Phase 1 Tasks 1.3 and 1.5               |
| Queue and Workflow orchestration                                          | Phase 2 Tasks 2.1 and 2.3               |
| Container runs dembrandt and uploads output                               | Phase 2 Task 2.2                        |
| R2 stores tokens, DESIGN.md, and PDF                                      | Phase 2 Tasks 2.2-2.3                   |
| R2 signed URLs expire after 24h                                           | Phase 2 Task 2.3, Phase 3 Task 3.4      |
| CORS for Cloudflare Pages frontend                                        | Phase 1 Task 1.4                        |
| Pending order expiry                                                      | Phase 3 Task 3.5                        |
| Completion email with D1 delivery log                                     | Phase 3 Task 3.4                        |
| Frontend preview and downloads                                            | Phase 4 Tasks 4.3-4.4                   |
| Release verification and Cloudflare deployment checklist                  | Phase 5 Tasks 5.1-5.3                   |
