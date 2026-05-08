# SePay Production Hardening Implementation Plan

Goal: Harden the existing SePay integration so paid orders cannot be lost, webhook handling is idempotent and retry-safe, order matching is resilient to bank memo changes, and the frontend can follow a paid order through to the created job.

Architecture: Keep the current Hono Worker, D1, KV, Queue, and React frontend architecture. Replace the current one-shot webhook flow with a retry-safe order/payment state flow: webhook receipt is logged first, processing can resume if partially completed, payments are unique by SePay transaction ID, orders store the created `job_id`, and frontend polls order status after showing the QR.

Tech stack: Cloudflare Workers, Hono, D1, Cloudflare Queues, TypeScript, Vitest, Vite React.

Implementation worktree: `E:\opendesign-codex\.worktrees\planb-backend`

## Summary

Current SePay code has the right skeleton, but production behavior is incomplete:

- Duplicate webhook detection returns too early and can lose a paid job after partial processing.
- Order matching only accepts exact uppercase `2D-XXXXXX`.
- Overpayment is incorrectly ignored.
- Webhook payload does not verify receiving account.
- Repeated `/api/extract` calls create multiple pending orders.
- Frontend shows QR but cannot poll payment/order completion.

The hardened flow must make SePay webhook processing resumable, idempotent, auditable, and user-visible.

## Task 1: Harden SePay Parsing and Verification

Files:

- `worker/src/services/sepay.ts`
- `worker/test/sepay.test.ts`

Steps:

1. Add failing parser and validation tests for lowercase order code normalization, transformed bank memo extraction, invalid order-code-like content rejection, amount classification, and optional recipient account verification.
2. Run `cd worker; npm test -- sepay.test.ts` and confirm the new tests fail for missing helpers/current parser behavior.
3. Implement `SePayWebhookPayload`, `SePayAmountStatus`, `classifySePayAmount`, `isExpectedSePayAccount`, and case-insensitive order-code normalization in `worker/src/services/sepay.ts`.
4. Verify with `cd worker; npm test -- sepay.test.ts; npm run typecheck`.
5. Commit as `fix: harden SePay parsing helpers`.

## Task 2: Make Webhook Processing Retry-Safe

Files:

- `worker/src/services/db.ts`
- `worker/src/routes/webhook.ts`
- `worker/test/webhook-route.test.ts`
- `worker/migrations/0001_init_core_tables.sql`

Steps:

1. Add failing webhook route tests for overpayment acceptance, underpayment ignore, resuming an existing `received` webhook event, and recipient account mismatch.
2. Update webhook test mock env with `SEPAY_BANK_ACCOUNT`, `SEPAY_BANK_NAME`, `SEPAY_BANK_ACCOUNT_NAME`, and a valid payload that includes `accountNumber`.
3. Run `cd worker; npm test -- webhook-route.test.ts` and confirm the new tests fail for current behavior.
4. Add DB helpers `getPaymentByProviderTransactionId` and `markOrderPaidWithJob`.
5. Make the webhook route resumable: only return early for already `processed` events, verify receiving account, ignore underpayment, accept exact/overpayment, dedupe payments by SePay transaction ID, create the job, store `orders.job_id`, mark the webhook processed, then enqueue the job.
6. Verify with `cd worker; npm test -- webhook-route.test.ts sepay.test.ts; npm run typecheck`.
7. Commit as `fix: make SePay webhook processing resumable`.

## Task 3: Reuse Pending Orders and Expose Order Status

Files:

- `worker/src/services/db.ts`
- `worker/src/routes/extract.ts`
- `worker/src/routes/orders.ts`
- `worker/src/app.ts`
- `worker/test/extract-route.test.ts`
- `worker/test/orders-route.test.ts`

Steps:

1. Add pending order DB helpers `OrderRecord`, `getActivePendingOrder`, and `getOrderStatusByCode`.
2. Reuse an active pending order in the extract route for the same IP hash, URL, email, and amount, and include `orderStatusUrl` in the 402 response.
3. Add `/api/orders/:orderCode` route returning order status and job poll URL.
4. Add extract route assertion and order route tests.
5. Verify with `cd worker; npm test -- extract-route.test.ts orders-route.test.ts; npm run typecheck`.
6. Commit as `feat: expose SePay order status`.

## Task 4: Update Frontend Payment Flow

Files:

- `frontend/src/api.ts`
- `frontend/src/pages/Home.tsx`
- `frontend/src/api.test.ts`
- `frontend/src/App.test.tsx`

Steps:

1. Extend the frontend payment response type with `orderStatusUrl`, add `OrderStatusResponse`, and add `getOrderStatus`.
2. Poll order status every 5 seconds after the QR is displayed, navigate to `/jobs/:jobId` when paid, and surface expired/cancelled payment errors.
3. Extend frontend API tests for `orderStatusUrl` and `getOrderStatus`.
4. Verify with `cd frontend; npm test; npm run build`.
5. Commit as `feat: poll SePay order status`.

## Task 5: Full Verification and Docs Cross-Link

Files:

- `docs/planB/phase3-payment-email.md`
- `docs/planB/phase5-release-verification.md`

Steps:

1. Add a SePay production hardening addendum to Phase 3 referencing this plan and required behavior.
2. Add SePay hardening verification checks to Phase 5.
3. Run full checks: `cd worker; npm test; npm run typecheck; cd ../frontend; npm test; npm run build`.
4. Commit as `docs: add SePay hardening plan references`.

## Acceptance Criteria

- SePay webhook handler never loses a paid order because of a partially processed duplicate event.
- Duplicate processed webhooks are harmless and return `200`.
- Existing received webhooks can resume processing.
- `2D-XXXXXX` order codes are matched case-insensitively from `code` or `content`.
- Underpayment is ignored; exact payment and overpayment are accepted.
- Receiving account is verified when `accountNumber` exists in the webhook payload.
- Paid orders store `job_id`.
- Returning users reuse one active pending order for the same URL/email/IP hash/amount.
- Frontend polls order status after showing QR and routes to `/jobs/:jobId` when paid.
- Worker and frontend verification commands pass.

## Assumptions

- The actual implementation branch/worktree is `E:\opendesign-codex\.worktrees\planb-backend`.
- SePay webhook authentication remains `Authorization: Apikey {SEPAY_API_KEY}` because this matches the PRD and current SePay dashboard auth mode.
- The short order code format `2D-XXXXXX` remains unchanged.
- Overpayment is accepted; underpayment is ignored and does not create a job.
- No schema migration file beyond `0001_init_core_tables.sql` is required unless production D1 has already applied `0001`.
