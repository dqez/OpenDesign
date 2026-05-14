# Frontend AGENT.md

## Scope

This file applies to all work under `frontend/`. It extends the root `AGENT.md` with frontend-specific UI/UX guidance.

OpenDesign frontend is a Vite + React SPA for:

- browsing generated design artifacts,
- submitting a URL and email for extraction,
- showing payment-required QR state,
- polling order and job status,
- previewing and downloading `tokens.json`, `DESIGN.md`, and `brand-guide.pdf`.

## Source Of Truth

Read before changing UI:

- `frontend/design-codex.md`: current visual direction and redesign research.
- `frontend/src/App.tsx`: route map.
- `frontend/src/api.ts`: backend contract used by the UI.
- The page/component/test files for the feature being changed.
- Root `AGENT.md` for project-wide constraints.

Conflict order:

1. Current user instruction.
2. This file.
3. `frontend/design-codex.md`.
4. Existing frontend code and tests.
5. General design preferences.

## Current Stack

- React 19, React Router 7, Vite 7, TypeScript, Vitest.
- CSS is plain CSS, imported from `frontend/src/styles.css`.
- Section styles live in `frontend/src/styles/`.
- GSAP and `@gsap/react` are already installed and used by `PinnedProcess`.
- No Tailwind, no shadcn, no separate design-system package.

Do not add a UI framework or component library unless the user explicitly asks.

## Frontend File Map

- `src/App.tsx`: route declarations.
- `src/pages/Home.tsx`: catalog, extraction form, payment QR, process sections.
- `src/pages/Status.tsx`: job polling and queued/processing/completed/failed states.
- `src/pages/Preview.tsx`: completed job artifact preview and downloads.
- `src/pages/DesignMdPage.tsx`: public catalog item detail view.
- `src/api.ts`: API request/response types and fetch helpers.
- `src/client-jobs.ts`: local job tracking used by status and toast UI.
- `src/design-artifacts.ts`: artifact fetch helpers.
- `src/design-token-parser.ts`: converts extracted tokens into preview model.
- `src/components/`: reusable visual and workflow components.
- `src/styles/`: page and component CSS modules imported through `src/styles.css`.

## Product UX Rules

- The first screen must remain a usable product experience, not a marketing-only landing page.
- Preserve the extraction flow: submit URL/email -> `202` job or `402` payment -> poll order/job -> preview/download artifacts.
- Preserve route paths unless the task explicitly changes navigation:
  - `/`
  - `/:brand/design-md`
  - `/jobs/:jobId`
  - `/jobs/:jobId/preview`
- Payment state must stay clear and operational: QR image, order code, amount, bank, account, transfer content.
- Completed jobs must keep obvious access to `tokens.json`, `DESIGN.md`, and `brand-guide.pdf`.
- Loading, empty, failed, and payment states need designed UI, not plain fallback text.
- Do not hide critical workflow controls inside decorative layouts.

## Visual Direction

Follow the current concept from `frontend/design-codex.md`: **Specimen Lab for Design Tokens**.

Design personality:

- editorial lab, not generic SaaS dashboard,
- light-first with a dark code/artifact rail where useful,
- precise 1px rules, specimen rows, token tables, and practical previews,
- one restrained mineral green accent,
- generous spacing with controlled information density.

Design dials:

- `DESIGN_VARIANCE: 8`
- `MOTION_INTENSITY: 6`
- `VISUAL_DENSITY: 4`

Use these dials to prefer asymmetric composition, useful motion, and clear artifact hierarchy without making the app feel busy.

## Anti-Patterns

Avoid:

- AI purple/blue gradients, neon glows, pure black backgrounds, generic glassmorphism.
- Centered hero-only pages that delay the extraction workflow.
- Equal 3-card feature rows as the main structure.
- Nested cards, oversized decorative cards, and decorative sections that do not help users act.
- Emoji-as-icon UI.
- Visible copy explaining how to use the UI when the controls can be self-explanatory.
- Text or controls that overlap, truncate poorly, or cause horizontal scroll on mobile.
- New abstractions or duplicate "enhanced" pages when existing pages can be improved directly.

## CSS And Layout Rules

- Reuse and extend CSS variables in `src/styles/base.css`.
- Keep global imports centralized in `src/styles.css`.
- Put page/component-specific styles in the existing file under `src/styles/` when possible.
- Use `min-height: 100dvh`, not `100vh`, for full-viewport sections.
- Use responsive CSS Grid/Flex with explicit `minmax`, `aspect-ratio`, `min-width: 0`, and stable dimensions where content could shift layout.
- Input font size must be at least `16px` to avoid mobile zoom.
- Keep letter spacing at `0` unless matching existing small mono labels.
- Respect `prefers-reduced-motion`.
- Animate `transform` and `opacity` first; avoid layout-triggering animation.
- Avoid heavy blur/backdrop effects on scrolling lists.

## Accessibility

- Keep semantic landmarks: `main`, `section`, `nav`, `header`, `footer`.
- Every input needs a real label.
- Buttons must be buttons; navigation must be links.
- Icon-only controls need accessible labels or visible text nearby.
- Preserve keyboard focus states with `:focus-visible`.
- Maintain readable contrast, especially on dark rails and accent buttons.
- Use `aria-live` only for meaningful status updates such as job state changes.

## Motion Rules

- GSAP is allowed because it is already installed, but keep it isolated to components that need scroll or staged animation.
- Always clean up through `useGSAP` scope or React lifecycle.
- Do not add a second motion library for the same change.
- Provide reduced-motion fallback.
- Motion must clarify progress, state, or hierarchy; do not animate purely to decorate.

## Implementation Workflow

- Start by identifying the exact user flow being improved.
- Read the matching page, component, style, and test files before editing.
- Preserve API calls and response handling unless the backend contract changes.
- Prefer editing existing files over creating parallel replacement pages.
- Extract a new component only when it removes real repetition or keeps a page readable.
- Update or add focused Vitest tests when markup, state transitions, routing, or API behavior changes.
- For visual-only CSS changes, run build and manually inspect relevant responsive states when feasible.

## Verification

For frontend-only changes:

```powershell
cd frontend
npm test
npm run build
cd ..
```

Before claiming UI work is complete, check at least:

- desktop and mobile widths,
- no horizontal scroll,
- no incoherent overlap,
- extraction form still submits,
- payment QR state still renders,
- status polling states still render,
- completed preview/download actions still render,
- reduced-motion fallback still leaves the page usable.

When a dev server is needed for review:

```powershell
cd frontend
npm run dev
```

Report the local URL Vite prints.
