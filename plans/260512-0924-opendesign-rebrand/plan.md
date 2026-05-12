---
title: "OpenDesign Rebrand"
description: "Concise implementation plan to replace 2Design branding with OpenDesign across frontend, worker, container, and scoped tests."
status: complete
priority: P2
effort: 1d
branch: chore/opendesign-rebrand
tags: [rebrand, frontend, worker, container]
created: 2026-05-12
---

# OpenDesign Rebrand Implementation Plan

## Assumptions
- Display brand becomes `OpenDesign`; slug becomes `opendesign`; glyph and new payment/order prefix become `OD`.
- Rebrand scope is string/config/test updates only. No schema change, route shape change, or unrelated cleanup.
- Worker baseline is already red before rebrand: `worker/test/email.test.ts:15-31` expects a `tokens` link that `worker/src/services/email.ts:13-20` omits; `worker/test/extraction-workflow.test.ts:146-176` expects `15 seconds` while `worker/src/workflows/extraction.ts:18,127-128` uses `60 seconds`.

## Verified Scope
- Browser/display copy enters from `frontend/index.html:5-27`, `frontend/src/components/site-header.tsx:7-12`, and `frontend/src/components/site-footer.tsx:41-59`.
- Payment identity flows from `worker/src/services/ids.ts:5` into API/test expectations in `worker/test/extract-route.test.ts:50-99` and `frontend/src/api.test.ts:27-90`, then back from SePay webhook parsing in `worker/src/services/sepay.ts:32-80` and `worker/test/sepay.test.ts:11-58`.
- Operational identity/config flows from `worker/wrangler.jsonc:3,22,32,79-80`, `worker/r2-cors.json:4-8`, `worker/src/routes/health.ts:4-8`, `worker/src/services/email.ts:9-20`, `container/package.json:2-11`, `container/src/health.ts:1-2`, and `container/src/execute.ts:47-50`.

## Phases
| Phase | Owner / Files | Depends On | Done When |
| --- | --- | --- | --- |
| 1. Frontend display rebrand | `frontend/index.html`, `frontend/src/components/site-header.tsx`, `frontend/src/components/site-footer.tsx`, `frontend/package.json` | none | Title/meta/header/footer/package name use OpenDesign/opendesign/OD where applicable. |
| 2. Worker identity + payment prefix | `worker/package.json`, `worker/wrangler.jsonc`, `worker/r2-cors.json`, `worker/src/routes/health.ts`, `worker/src/services/email.ts`, `worker/src/services/ids.ts`, `worker/src/services/sepay.ts` | none | Worker strings use OpenDesign/opendesign/OD; new order codes write `OD-...`; webhook parsing remains backward-compatible for legacy `2D-...`. |
| 3. Container identity rebrand | `container/package.json`, `container/src/health.ts`, `container/src/execute.ts` | none | Container package/image/health/tmpdir identifiers reflect OpenDesign/opendesign/OD naming. |
| 4. Scoped test/config sweep + verification | `frontend/src/api.test.ts`, `worker/test/cors.test.ts`, `worker/test/designs-route.test.ts`, `worker/test/email.test.ts`, `worker/test/extract-route.test.ts`, `worker/test/health.test.ts`, `worker/test/jobs-route.test.ts`, `worker/test/orders-route.test.ts`, `worker/test/r2.test.ts`, `worker/test/route-mocks.ts`, `worker/test/sepay.test.ts`, `worker/test/webhook-route.test.ts`, `container/test/execute.test.ts`, `container/test/health.test.ts`, `container/test/r2.test.ts` | 1,2,3 | Assertions match new strings/prefixes, legacy compatibility coverage exists for `2D`, and no new failures are introduced beyond the two known worker baselines unless explicitly fixed in same branch. |

## Execution Notes
- Update display-only strings first, then worker prefix/config, then container identifiers, then tests. Keep phases sequential for review even though files are disjoint.
- Treat package names and local tmpdir/image tags as low-risk code changes; treat Cloudflare names/origins/buckets in `worker/wrangler.jsonc:3,22,32,79-80` and `worker/r2-cors.json:4-8` as rollout-sensitive config.
- Regenerate derived worker config types after any `wrangler.jsonc` change via `worker/package.json:5-10` (`npm run types`) and include the generated diff only if it changes.

## Backwards Compatibility
- Use dual-read, single-write for order codes: emit `OD-...` from `worker/src/services/ids.ts:5`, but keep webhook/order-code normalization tolerant of existing `2D-...` values in `worker/src/services/sepay.ts:32-80` until old pending orders age out.
- Avoid silent infra breakage: if Cloudflare D1/R2/Pages resource renames are not provisioned yet, split runtime resource renames from display/package rebrand and keep existing resource IDs live for this pass.

## Risks
- High: renaming Cloudflare-facing names in `worker/wrangler.jsonc:3,22,32,79-80` can break deploy/runtime if matching resources do not exist. Mitigation: verify infra rename/alias plan before merge; otherwise keep resource names stable and rebrand only app-visible strings.
- High: changing `2D` to `OD` without legacy parsing strands in-flight payments/webhooks. Mitigation: preserve `2D` read support in `worker/src/services/sepay.ts:32-80` and add/keep tests proving both formats.
- Medium: changing `worker/src/services/email.ts:9-20` sender address may fail if the domain is not configured. Mitigation: if sender domain ownership is unverified, only change display name/subject in this pass.

## Test Matrix
- Frontend: run `npm test` and `npm run build` in `frontend`; verify `frontend/src/api.test.ts:27-90` uses `OD`/`OpenDesign`.
- Worker: run `npm test`, `npm run typecheck`, and `npm run types` in `worker`; update scoped assertions in `worker/test/cors.test.ts:4-20`, `worker/test/extract-route.test.ts:50-99`, `worker/test/health.test.ts:4-13`, `worker/test/orders-route.test.ts:5-36`, `worker/test/route-mocks.ts:35-60`, `worker/test/sepay.test.ts:11-58`, `worker/test/webhook-route.test.ts:37-60,174-179`, `worker/test/jobs-route.test.ts:31-39`, `worker/test/designs-route.test.ts:90-100`, `worker/test/r2.test.ts:5-14`, plus the known baseline failures above.
- Container: run `npm test`, `npm run typecheck`, and `npm run build` in `container`; update `container/test/health.test.ts:4-8`, `container/test/execute.test.ts:15-17`, and `container/test/r2.test.ts:19-46`.

## Rollback
- Frontend/container rollback is direct string reversion in package/UI/service identifiers.
- Worker rollback keeps the compatibility parser in place first, then reverts `OD` writers/config if deployment or payment reconciliation regresses.

## Success Criteria
- No targeted user-facing/package/test files still expose `2Design`/`2design`/`2D` except deliberate legacy compatibility handling or an explicitly deferred infra resource rename.
- New outbound/user-facing brand is `OpenDesign`; new generated order codes start with `OD-`.
- Package verification passes for `frontend` and `container`; `worker` has no additional failures beyond the pre-existing two baseline mismatches unless those are explicitly fixed as part of the rebrand.

## Completion Notes
- Implemented in worktree `E:/opendesign-rebrand` on branch `chore/opendesign-rebrand`.
- Replaced active `2Design`/`2design` display, package, service, config, test, and doc references with `OpenDesign`/`opendesign`.
- New order codes emit `OD-`; webhook parsing remains compatible with legacy `2D-` pending payments.
- Fixed two pre-existing worker test mismatches discovered at baseline: completion emails now include `tokens.json`, and workflow polling test expects the existing `60 seconds` interval.
- Verification passed: frontend tests/build, worker tests/typecheck/types, container tests/typecheck/build.
