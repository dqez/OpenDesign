# Design: DESIGN.md Detail Page

## Goal

Build a frontend detail page for `/:brand/design-md` that turns extracted
design artifacts into a useful, polished viewer. The page should feel like a
"Design System Inspiration Page": a generated preview first, with raw
`DESIGN.md` available in a tab, plus copy and download actions.

## Scope

In scope:

- Replace the current placeholder `DesignMdPage`.
- Load the selected brand from the catalog by URL slug.
- Fetch `DESIGN.md` and `tokens.json` from signed R2 URLs.
- Render a token-driven preview with design-system sections.
- Provide raw markdown view, copy action, and download action.
- Handle missing API fields with a polished fallback state.

Out of scope for this pass:

- Rendering markdown as rich HTML.
- Recreating the exact source website layout.
- Adding a new backend route from frontend work.
- Using real photography unless the API later provides image assets.

## Data Contract

The frontend expects `GET /api/designs` items to include:

```ts
type DesignCatalogItem = {
  slug: string;
  brand: string;
  sourceUrl: string;
  updatedAt?: string;
  designMdUrl: string;
  tokensUrl?: string;
  brandGuideUrl?: string;
};
```

`tokensUrl` is optional during backend transition. If it is missing, the detail
page still shows raw `DESIGN.md` and explains that token preview is not ready.

## Page Structure

Top shell:

- Brand mark links back to `/`.
- Breadcrumb-style back link to the catalog.
- Brand name, source URL, and updated date.
- Actions: copy `DESIGN.md`, download `DESIGN.md`, and optional brand guide.

Tabs:

- `Preview`: default tab.
- `DESIGN.md`: raw markdown panel.

The tab layout should work on mobile without horizontal overflow. Buttons should
use clear command labels and reuse existing site styling where possible.

## Preview Composition

The preview is generated from DTCG token JSON. It does not claim to clone the
original website. It shows how the extracted design language could be used.

Sections:

1. Hero specimen: brand name, source URL, short generated intro, CTA samples.
2. Color palette: swatches from `color.palette` and semantic colors.
3. Typography scale: font family tokens and typography style samples.
4. Button variants: primary, outline, text-link, icon button samples.
5. Cards and containers: editorial cards using extracted surface, border,
   radius, and typography values.
6. Spec cells: metric grid showing large numbers and uppercase labels.
7. Form elements: input, focused input, textarea, and cookie-style notice.

Preview content should be generic enough to work for Neon, Senlyzer, Supabase,
and future brands, while still adopting each brand's tokens.

## Token Parsing Rules

- Extract colors from DTCG values where `$value.hex` exists.
- Fallback to string hex values for older token shapes.
- Extract typography from `typography.font-family` and `typography.style`.
- Extract spacing/radius dimensions from `$value.value` + `$value.unit`.
- Clamp absurd radius values before applying them visually.
- If a token group is missing, use restrained defaults and avoid noisy errors.

## Error And Loading States

- Loading state: skeleton panel inside the detail shell.
- Brand not found: friendly message with a back-to-catalog action.
- Missing `DESIGN.md`: show preview if tokens exist, disable copy/download.
- Missing `tokensUrl`: show raw `DESIGN.md` and a soft preview-unavailable
  panel.
- Fetch failure: do not show raw technical errors in the UI; log details to
  console for development.

## Components

Recommended small components:

- `DesignMdPage`: route orchestration and data loading.
- `DesignPreview`: generated design-system preview.
- `RawDesignMdPanel`: raw markdown tab with copy/download.
- `design-token-parser.ts`: small pure helpers for token extraction.

Keep files under 200 lines where practical.

## Testing

Frontend tests should cover:

- Route placeholder is replaced by the detail shell.
- Catalog item lookup by slug.
- Fallback when `tokensUrl` is absent.
- Raw markdown panel renders fetched content.
- Token parser extracts hex colors from DTCG `$value.hex`.

Manual verification:

- Run frontend with `VITE_API_BASE=https://opendesign-api.quysprolegend.workers.dev`.
- Open `/senlyzer/design-md`.
- Confirm preview tab loads without console crashes.
- Confirm raw tab, copy, and download actions work.

## Open Dependency

Backend should add `tokensUrl` and optional `brandGuideUrl` to `/api/designs`.
The frontend must tolerate their absence until that backend deployment lands.
