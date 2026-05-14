# OpenDesign Liquid Glass Redesign Design

Date: 2026-05-12
Status: Approved design direction, pending implementation plan
Project: `E:\opendesign-rebrand\frontend2`

## 1. Purpose

Redesign the current OpenDesign frontend into a premium, light-mode interface for showing and extracting design tokens.

The target feel is Apple-like: smooth, refined, rounded, and liquid, with glass-like borders and subtle refraction. The product must still read as a serious design-token tool, not as a decorative landing page. URLs, tokens, raw markdown, job status, and downloadable artifacts remain first-class content.

This document is the durable context for future long-running implementation. It records the approved visual direction, page priorities, route behavior, layout decisions, and non-goals.

## 2. Current Project Context

The frontend is a Vite + React + TypeScript app using React Router and vanilla CSS. Existing routes:

- `/`: Home page with catalog, extraction form, payment panel, output/proof sections, process section, footer, and progress toast.
- `/jobs/:jobId`: Job status page with polling for queued, processing, completed, and failed states.
- `/jobs/:jobId/preview`: Fullscreen artifact preview page.
- `/:brand/design-md`: Brand design artifact page with token preview and raw `DESIGN.md`.

Relevant source files:

- `src/pages/Home.tsx`
- `src/pages/Status.tsx`
- `src/pages/Preview.tsx`
- `src/pages/DesignMdPage.tsx`
- `src/components/site-header.tsx`
- `src/components/site-footer.tsx`
- `src/components/design-catalog.tsx`
- `src/components/design-preview.tsx`
- `src/components/raw-design-md-panel.tsx`
- `src/components/TokenBento.tsx`
- `src/components/pinned-process.tsx`
- `src/styles/*.css`

Current behavior to preserve:

- Home extraction form calls `createExtraction`.
- Payment flow renders QR/order details when payment is required.
- Payment polling calls `getOrderStatus` and navigates to the job route when a job is created.
- Job status route polls `getJob` every 3 seconds while queued or processing.
- Completed jobs link to `/jobs/:jobId/preview`.
- Preview route loads `tokens.json` and `DESIGN.md` artifacts.
- Design artifact route loads catalog item by slug, fetches text/json artifacts, supports Preview and DESIGN.md tabs, supports copy/download/brand guide actions, and supports light/dark preview theme.
- Existing test expectations around page copy and loading states should remain meaningful, though copy can be updated deliberately with corresponding tests.

## 3. Approved Design Direction

Name: Liquid Specimen Workspace.

Principles:

- Light mode first.
- Full glass islands for primary surfaces.
- Liquid/refraction borders on key UI elements.
- Strong rounded geometry, especially navigation, forms, buttons, screenshot slot, and content islands.
- Calm, premium, Apple-like motion and materiality.
- Technical content stays readable and inspectable.
- Do not make the UI look like generic glassmorphism. Use glass as a functional material for controls, previews, and workspace panels.

Design should feel:

- Smooth, quiet, precise.
- High-end but not flashy.
- More like a native Apple workspace than a generic SaaS landing page.
- Suitable for both human review and agent handoff.

Design should not feel:

- Purple/blue AI gradient SaaS.
- Dark cyber dashboard.
- Decorative glass everywhere with poor readability.
- Ecommerce/Nike clone.
- Raw admin panel.

## 4. Research Signals

Apple-style inspiration is used as a design reference, not a clone target.

Useful ideas from Apple-style interfaces:

- Glass-like surfaces work best as functional layers: navigation, controls, panels, toolbars, and preview containers.
- Typography inside glass needs to be softer and more precise than standard admin labels.
- Screenshot/media surfaces should have stable aspect ratios and should not cause layout jumps.
- Strong rounded geometry should be consistent: parent and child radii must feel mathematically related.

Typography reference:

- Use system UI font stack for primary UI so Apple devices render San Francisco naturally and Windows uses Segoe UI.
- Use a mono font only for URL, token, code, file, and artifact data.

External references recorded during brainstorming:

- Apple Human Interface Guidelines, Materials: `https://developer.apple.com/design/human-interface-guidelines/materials`
- Apple Fonts: `https://developer.apple.com/fonts/`

## 5. Locked Decisions

### 5.1 Visual Material

Use a full glass island system.

Core material recipe:

- Light translucent surface.
- 1px light border.
- Inner top highlight.
- Subtle lower inner shade.
- Soft tinted shadow.
- Backdrop blur and saturation where supported.
- Solid readable fallback where backdrop blur is unsupported.

Glass should be used for:

- Header/nav.
- Hero extraction panel.
- Input fields.
- Catalog cards.
- Output proof panels.
- Process cards.
- Status panels.
- Preview toolbars.
- Design detail workspace panels.
- Empty screenshot preview slot.

Glass should not be used blindly for:

- Raw markdown/code interior, which should remain high-contrast.
- Dense token text where transparency hurts readability.
- Every nested child element, which would create visual noise.

### 5.2 Typography

Primary UI:

- Use system sans stack: `-apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.
- Labels use sentence/title case, not all-caps.
- Avoid wide tracking on form labels.
- Use negative or tight letter spacing only for display headings and brand text where it improves polish.

Technical data:

- Use mono stack for URL, code, token names, file names, artifact metadata, and job IDs.
- Keep mono text smaller and controlled.
- Do not use mono for large body copy.

Rejected typography:

- All-caps `WEBSITE URL` labels.
- Generic bold nav text with no brand treatment.
- Heavy display text inside compact form fields.

### 5.3 Brand Lockup

Use split-tone OpenDesign wordmark:

- Monogram: `OD`.
- Wordmark: `OpenDesign`.
- `Open` should feel primary.
- `Design` should be subtly muted, not invisible.
- Wordmark lives in the header and can also appear in footer.

Implementation guidance:

- Use a small rounded glass monogram chip.
- Avoid making `OpenDesign` look like plain nav text.
- Keep the lockup compact enough for sticky header and mobile layout.

### 5.4 Home Page Order

Home order is locked:

1. Extract hero.
2. Catalog.
3. Output proof.
4. Process.
5. Footer.

This is a change from the current implementation, where catalog appears before extraction.

### 5.5 DesignMdPage Priority

`DesignMdPage` is the highest-impact "wow" page.

It must still provide:

- Preview view.
- Raw `DESIGN.md` view.
- Copy action.
- Download action.
- Brand guide action when available.
- Source URL.
- Light/dark preview theme if retained by implementation.

It must add:

- A reserved website preview image slot.
- The slot is empty for now.
- The slot is a landscape rectangle.
- The preferred ratio is 16:9 or close.
- It should reserve stable layout space before the future screenshot feature exists.
- Under the image slot, show summary + artifact actions.

Important non-goal:

- Do not implement screenshot capture, OG image fetching, or actual image rendering in this redesign phase unless separately planned. The requirement is only the reserved frame and placeholder state.

## 6. Page Specifications

## 6.1 Shared App Shell

The shared shell should establish the liquid workspace:

- Light atmospheric background with restrained blue and warm highlights.
- No dark full-page background.
- Sticky glass header.
- Split-tone OpenDesign lockup.
- Rounded pill navigation.
- Smooth hover/active states using transform and opacity only.
- Consistent max-width, likely around the current `1400px`.
- Mobile layout collapses to one column without horizontal scroll.

Header:

- Sticky near top with safe spacing.
- Full glass pill or rounded capsule.
- Left: `OD` monogram + split-tone `OpenDesign`.
- Right: anchors for Catalog, Extract, Process, and any route-relevant action.
- Active/primary action should be dark ink pill on glass.

Footer:

- Redesign to match glass system.
- Keep existing footer content categories unless implementation finds obsolete links.
- Footer should feel like a final glass panel plus link directory, not a marketing-heavy CTA block.

Buttons:

- Primary: dark ink pill with white text.
- Secondary: translucent glass pill.
- Tertiary/text links: minimal, with strong focus state.
- Active press: subtle downward transform or scale.

Forms:

- Labels above inputs.
- Labels use sentence/title case.
- URL and email input areas can sit inside a larger glass extraction island.
- URL value/input should use mono or a clear technical font treatment.
- Error messages stay inline and visible.

States:

- Loading: skeletons or shimmer-like blocks matching layout, no generic spinner-only state.
- Empty: calm glass panel with specific next action.
- Error: clear text, no vague "something went wrong" if better info is available.

## 6.2 Home Page

Route: `/`

Primary job:

- Let users extract design tokens immediately.
- Then prove that extracted artifacts are browsable and useful.

Section order:

1. Extract hero.
2. Catalog.
3. Output proof.
4. Process.
5. Footer.

### Extract Hero

Purpose:

- Make the first viewport usable, not just explanatory.

Content:

- Headline: concise value prop around extracting design tokens from a public URL.
- Supporting copy: explain outputs such as `DESIGN.md`, `tokens.json`, preview, and brand guide.
- Form fields: Website URL and Email.
- Primary CTA: Extract tokens.
- Error line under form when needed.

Visual:

- Full glass hero island or glass form island over atmospheric light background.
- Extract form should be the dominant interactive element.
- Use `Website URL`, not all-caps.
- URL placeholder/value uses mono.
- Button is dark pill.

Behavior to preserve:

- `onSubmit` uses existing `createExtraction`.
- Payment-required responses show payment panel.
- Non-payment responses save client job and navigate to status page.
- Submitting state disables button and shows progress copy.

### Catalog Section

Purpose:

- Show that OpenDesign is also a catalog of existing extracted design systems.

Current component:

- `DesignCatalog`.

Design:

- Keep search capability.
- Cards become rounded glass catalog tiles.
- Use brand name, source URL, and date if available.
- Search field should match glass form styling.
- Loading/empty/unavailable states should match the new visual system.

Placement:

- Directly after extract hero.

### Output Proof Section

Purpose:

- Show what the extraction produces.

Current component:

- `TokenBento`.

Design:

- Keep color, typography, spacing, `DESIGN.md`, and brand guide proof.
- Restyle as liquid/glass bento but avoid over-nesting cards.
- Include one high-contrast dark code/artifact rail for raw output.
- Do not let this section become a generic three-card feature row.

Motion:

- Existing GSAP reveal can be retained if it remains transform/opacity based and respects reduced motion.

### Process Section

Purpose:

- Explain URL to artifacts without becoming the main story.

Current component:

- `PinnedProcess`.

Design:

- Use a compact sequence of glass process cards or rows.
- Keep the four-step story: Paste URL, Extract tokens, Write artifacts, Review system.
- Should be secondary after catalog and output proof.

## 6.3 Status Page

Route: `/jobs/:jobId`

Primary job:

- Calmly show extraction progress and next action.

Behavior to preserve:

- Poll `getJob(jobId)`.
- Continue polling while queued or processing.
- Stop polling when completed or failed.
- Keep client job email/source context if available.
- Show completed preview link only when completed.

Design:

- Single centered or slightly offset glass status island.
- Job ID shown as mono metadata.
- Current state should be visually obvious.
- Queued and processing need a calm animated or skeleton treatment.
- Completed state should promote "Open fullscreen preview".
- Failed state should show failure reason if present.

Avoid:

- Overly busy dashboard progress.
- Decorative status icons that reduce clarity.
- Emoji-like symbols. Current text icons should be replaced or made typographic/shape-based during implementation if possible.

## 6.4 Job Preview Page

Route: `/jobs/:jobId/preview`

Primary job:

- Provide a polished fullscreen review of generated artifacts.

Behavior to preserve:

- Load job.
- Fetch `tokens.json`.
- Fetch `DESIGN.md`.
- Update client job from response.
- Show artifact links for tokens, DESIGN.md, and brand guide when available.
- Show error/loading states.

Design:

- Glass toolbar at top with brand/source context.
- Artifact actions as compact pills.
- Main content should prioritize `DesignPreview`.
- Raw `DESIGN.md` panel can sit below or after preview.
- Use light mode by default.
- Keep raw markdown readable with a high-contrast code surface.

Relationship to DesignMdPage:

- Job Preview is polished but not the highest-wow page.
- DesignMdPage gets the stronger editorial/show-page treatment.

## 6.5 DesignMdPage

Route: `/:brand/design-md`

Primary job:

- Be the premium show page for an extracted design system.

Behavior to preserve:

- Load catalog.
- Find item by slug.
- Fetch `DESIGN.md`.
- Fetch tokens.
- Build preview model.
- Support not-found, loading, and failed states.
- Support Preview and DESIGN.md views.
- Support copy markdown.
- Support download.
- Support brand guide link if present.
- Support source URL link.

### Layout

Preferred desktop composition:

- Header/detail summary at top.
- Main workspace with two columns.
- Left column:
  - 16:9 landscape website preview image slot.
  - Summary panel.
  - Primary artifact actions.
- Right column:
  - Token preview and/or active tab content.
  - Raw DESIGN.md content when selected.
- Controls can be in a compact rail or integrated toolbar, but they must not dominate the visual hierarchy.

Mobile composition:

1. Header/detail summary.
2. Image slot.
3. Summary + actions.
4. Tabs/theme controls.
5. Active content.

### Website Preview Image Slot

This is a reserved placeholder only.

Requirements:

- Landscape rectangle, target ratio 16:9.
- Rounded glass frame.
- Dashed or subtle empty-state interior.
- Placeholder text: concise, e.g. "Website preview image slot".
- Stable size before image exists.
- No screenshot capture.
- No network call to fetch OG image.
- No new API contract required in this design phase.

Future-friendly implementation:

- The eventual component can accept an optional `previewImageUrl`.
- If `previewImageUrl` exists, render an image with object-fit cover/contain according to later requirements.
- If not, render the current placeholder.
- The layout must not change when an image becomes available.

### Summary + Actions Under Image

Purpose:

- Prevent empty space below the landscape screenshot slot.
- Add useful context without clutter.

Content:

- Short summary of extracted system, using available model signals where practical.
- If dynamic summary is not available during implementation, use static but accurate copy describing the artifact state.
- Actions:
  - Copy DESIGN.md.
  - Download DESIGN.md.
  - Brand guide when available.
  - Source URL link can be present if it does not crowd the area.

Design:

- Summary is a glass panel.
- Actions are compact pill or tile buttons.
- Keep labels short.

### Preview and Raw DESIGN.md

Preview:

- Keep current `DesignPreview` behavior but restyle to feel integrated with the new page.
- Show color palette, typography, buttons, cards/containers, spec cells, and form elements.
- Avoid generic card overuse.

Raw:

- Keep raw markdown as a readable code panel.
- Use dark or high-contrast surface even in light theme.
- Preserve copy/download actions.
- Large markdown should scroll internally or within a controlled content area.

### Theme Toggle

Current page supports light/dark preview mode.

Implementation can retain it, but visual priority should stay on the light glass shell. Dark mode should apply to preview content or raw artifact surfaces, not make the whole route become a dark app unless explicitly planned later.

## 7. Component Design Guidelines

### Glass Island Utility

Create a repeatable CSS pattern rather than duplicating long declarations everywhere.

Potential CSS concept:

- `.glass-surface`
- `.glass-panel`
- `.glass-pill`
- `.glass-field`

Do not introduce a complex abstraction system. Keep it CSS-level and practical.

### Radii

Use strong rounded geometry:

- Header/nav capsule: pill or large radius.
- Major panels: 28-36px.
- Inner panels: 20-28px.
- Small controls: pill or 16-20px.

Use consistent nested radii:

- Inner radius should usually be parent radius minus inner padding.
- Avoid mismatched square corners inside glass containers.

### Color Palette

Light base:

- Background: near-white with cool/warm atmospheric gradients.
- Ink: off-black, not pure black.
- Muted text: slate/gray.
- Glass borders: white and light slate alpha.
- Primary CTA: off-black.
- Code/raw panel: off-black with soft white text.

Avoid:

- Purple/blue neon.
- Heavy saturated accents.
- One-note beige or gray-only UI.
- Pure black `#000`.

### Motion

Use existing GSAP only where it already fits, or simple CSS transitions.

Allowed:

- Transform and opacity.
- Staggered reveal.
- Hover lift.
- Active press.
- Reduced-motion fallback.

Avoid:

- Animating width/height/top/left.
- Scroll hijacking.
- Continuous expensive backdrop animations.
- New motion dependency unless separately approved.

## 8. Accessibility and Responsiveness

Accessibility:

- Preserve semantic HTML: forms, labels, nav, buttons, links.
- Maintain visible focus states.
- Do not rely on translucency alone for boundaries.
- Ensure text contrast inside glass surfaces remains readable.
- Raw code must be readable without relying on background blur.
- Avoid tiny labels below practical reading size.

Responsiveness:

- Desktop can use asymmetric two-column layouts.
- Below tablet width, collapse to one column.
- No horizontal scroll.
- Use stable aspect ratios for screenshot/image slots.
- Avoid `h-screen`; use `min-height: 100dvh` where full-height behavior is needed.

## 9. Performance Constraints

- Backdrop blur can be expensive; use it on a controlled number of fixed surfaces, not every nested child.
- Do not apply animated gradients or filters to large scrolling containers.
- Use static atmospheric background gradients.
- Keep GSAP scopes limited and clean.
- Preserve reduced-motion CSS behavior.
- Do not add heavy image/canvas/WebGL effects.

## 10. Non-Goals

This redesign must not:

- Add new backend features.
- Add screenshot capture.
- Fetch OG images.
- Change API contracts.
- Add new routes.
- Rewrite the extraction flow.
- Rewrite job polling.
- Replace React Router.
- Migrate to Tailwind.
- Introduce a design system package.
- Add icon dependencies unless implementation later proves it is worth it.
- Remove existing functionality to simplify the design.

## 11. Implementation Boundaries

Expected implementation type:

- Mostly CSS and JSX layout changes.
- Component-level restructuring where needed.
- No business logic rewrites unless required by layout movement.

Likely touched files:

- `src/pages/Home.tsx`
- `src/pages/Status.tsx`
- `src/pages/Preview.tsx`
- `src/pages/DesignMdPage.tsx`
- `src/components/site-header.tsx`
- `src/components/site-footer.tsx`
- `src/components/design-catalog.tsx`
- `src/components/design-preview.tsx`
- `src/components/raw-design-md-panel.tsx`
- `src/components/TokenBento.tsx`
- `src/components/pinned-process.tsx`
- `src/styles.css`
- `src/styles/base.css`
- `src/styles/home.css`
- `src/styles/catalog.css`
- `src/styles/design-detail.css`
- `src/styles/design-preview.css`
- `src/styles/footer.css`
- `src/styles/process.css`
- `src/styles/token-bento.css`

Potential new component:

- `src/components/website-preview-image-slot.tsx`

If created, it should be small and focused:

- Accept no props initially, or accept optional `previewImageUrl?: string` only if useful.
- Render the empty reserved frame.
- Avoid networking and feature logic.

File naming:

- Use kebab-case for any new file.

## 12. Testing and Verification

Run after implementation:

- `npm test`
- `npm run build`

Manual checks:

- Home first viewport shows extract form before catalog.
- Catalog still loads, filters, and handles unavailable/empty/loading states.
- Extraction form still submits.
- Payment QR panel still appears when required.
- Status route still polls and transitions.
- Completed status still links to preview.
- Job preview still loads tokens and DESIGN.md.
- DesignMdPage still loads catalog item by slug.
- Preview and DESIGN.md tabs still work.
- Copy DESIGN.md still works.
- Download and brand guide links still render when available.
- Website preview image slot appears empty and stable on DesignMdPage.
- Mobile layout has no horizontal overflow.
- Focus states are visible.
- Reduced motion mode does not animate heavily.

Visual checks:

- Glass material is visible but text remains readable.
- `OpenDesign` wordmark does not look like plain text.
- URL/token/code data uses mono treatment.
- Form labels are not all-caps.
- Raw markdown has sufficient contrast.
- DesignMdPage feels like the premium show page.

## 13. Acceptance Criteria

The redesign is successful when:

- The app feels like a premium light-mode liquid workspace.
- Home starts with extraction, then catalog, then output proof, then process, then footer.
- All existing routes are visually redesigned consistently.
- Existing route behavior is preserved.
- DesignMdPage has the strongest visual impact.
- DesignMdPage includes a stable empty 16:9 website preview image slot.
- The space under the image slot contains summary + actions.
- No screenshot/OG feature is implemented accidentally.
- Tests and build pass.

## 14. Open Questions

No blocking design questions remain.

Implementation may still decide exact copy, final CSS variable names, and whether the website preview slot is a dedicated component or inline JSX. Those decisions should follow the constraints in this spec.
