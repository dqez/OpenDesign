# OpenDesign Frontend Redesign Codex

Research date: 2026-05-09
Scope: `.worktrees/planb-backend/frontend`
Status: Review draft only. No UI code has been changed.

## 1. Assumptions

- `design-codex.md` is the review artifact before implementation.
- The redesign should make the product feel like a real website, not only a small internal form.
- The existing extraction, payment, job status, and preview flows must remain intact.
- The implementation should stay close to the current Vite + React + vanilla CSS stack unless new motion dependencies are explicitly approved.
- Inspiration from `getdesign.md` and `styles.refero.design` is limited to token extraction and pattern study. The final visual system must not clone either site.

## 2. Current Frontend Audit

Files reviewed:

- `src/App.tsx`
- `src/pages/Home.tsx`
- `src/pages/Status.tsx`
- `src/pages/Preview.tsx`
- `src/styles.css`
- `package.json`
- existing `design.md`

Current stack:

- Vite 7, React 19, React Router 7, TypeScript, Vitest.
- No Tailwind, no GSAP, no Framer Motion, no icon package.
- Global CSS in `src/styles.css`.

Main design problems:

- The product currently reads as a compact app panel, not a website with narrative, credibility, and conversion structure.
- `styles.css` uses `Inter`, which conflicts with the requested taste-skill direction.
- `.app-shell` uses `min-height: 100vh`; switch to `min-height: 100dvh` during implementation.
- The home page has no navigation, footer, proof, how-it-works, or artifact preview.
- The hero is a form inside a card, not a strong first viewport signal.
- Loading state is text/button-only; preview/status flows need skeletons and clearer intermediate states.
- Preview page is functional but visually raw: token categories need hierarchy, swatches, density control, and artifact actions.

## 3. Reference Research

Sources researched:

- `https://getdesign.md/`
- `https://styles.refero.design/`

### 3.1 getdesign.md observed tokens and patterns

Purpose observed: a browsable DESIGN.md collection for AI coding agents. The page presents a production-grade DESIGN.md library, quick stats, featured designs, and a dense design-system directory.

Extracted visual tokens:

```css
--font-sans: Geist;
--font-mono: Geist Mono;
--font-display: GeistPixel-Line / GeistPixel-Square;
--color-background: #000;
--color-background-100: #0a0a0a;
--color-background-200: #111;
--color-foreground: #ededed;
--color-muted: #1a1a1a;
--color-muted-foreground: #878787;
--color-border: #2e2e2e;
--color-card: #111;
--color-accent: #ffb1ee;
```

Useful patterns:

- Dense directory rows with monospace names and compact metadata.
- Sticky dark header with a hard 1px divider.
- Pixel/code personality through type, not through decorative illustrations.
- Repeating line texture and table-like information hierarchy.

Do not copy:

- Pixel wordmark treatment.
- Pink accent.
- Exact dark directory layout.
- Windows-95 visual motif in the hero area.

### 3.2 styles.refero.design observed tokens and patterns

Purpose observed: a style search surface for AI agents. It searches curated references by brand, mood, color, typography, or URL, then exposes colors, type, spacing, components, and DESIGN.md output.

Extracted visual tokens:

```css
--font-neue-montreal: "neueMontreal";
--font-kalice: "kalice";
--font-jetbrains-mono: "JetBrains Mono";
--background: #fff;
--foreground: #0d0f15;
--card: #fff;
--border: #dfe1e7;
--muted: #edeef3;
--muted-foreground: #6f7179;
--primary: #0d0f15;
--secondary: #f7f8fb;
--spacing: .25rem;
--radius-xs: .125rem;
```

Gray scale observed:

```css
--gray-solid-100: #f7f8fb;
--gray-solid-200: #eef0f6;
--gray-solid-300: #dddfea;
--gray-solid-700: #525769;
--gray-solid-900: #13151b;
```

Useful patterns:

- Clean, search-first hero.
- Large but controlled display type.
- Soft gallery cards with real thumbnails.
- Simple tabs for `Trending`, `Popular`, `Newest`.
- Clear promise: search a URL or reference, then open a style artifact.

Do not copy:

- Centered beta-pill hero.
- Exact search input layout.
- Exact neutral gray palette.
- Card gallery proportions.

## 4. Anti-Clone Direction

Recommended concept: **Specimen Lab for Design Tokens**

This should feel like a public website for a precise extraction instrument. It is not a plain SaaS landing page and not a gallery clone. The memorable idea is a URL becoming a "specimen tray" where color, type, spacing, radius, and documents are separated into visible layers.

Design personality:

- Editorial lab, not app dashboard.
- Light-first with a dark "token rail" for code artifacts.
- Precise 1px rules and specimen tables, but with generous website spacing.
- One accent only: restrained mineral green.
- No AI purple/blue gradient, no neon glow, no pure black.

## 5. Design Dials

```txt
DESIGN_VARIANCE: 8
MOTION_INTENSITY: 6
VISUAL_DENSITY: 4
```

Implications:

- Use an asymmetric hero, not a centered hero.
- Use CSS Grid with fractional columns on desktop, strict one-column layout below 768px.
- Use large website sections with strong whitespace.
- Use transform/opacity motion only.
- Use cards only where they clarify hierarchy; use dividers and specimen rows elsewhere.

## 6. gpt-taste Preflight

```txt
mock_python(seed=405) -> hero="Artistic Asymmetry", font="Outfit + JetBrains Mono"
mock_python(seed=405) -> components=["inline specimen strip", "gapless token bento", "horizontal artifact rail"]
mock_python(seed=405) -> motion=["GSAP pinned token stack", "scrubbed specimen reveal"]
```

AIDA check:

- Navigation: slim website nav with product name, process links, and primary action.
- Attention: asymmetric hero with URL extraction form and live specimen panel.
- Interest: gapless token bento explaining colors, type, spacing, and docs.
- Desire: pinned scroll section showing URL -> crawler -> token JSON -> DESIGN.md -> brand guide.
- Action: footer CTA plus privacy/terms links.

Hero math:

- Desktop H1 container: `max-width: 980px`.
- H1 scale: `clamp(3rem, 6vw, 5.75rem)`.
- Target: 2 to 3 lines max on desktop, 3 to 4 lines on mobile.
- No stamp icons, no badge pile, no raw stats in the hero.

Bento density:

- Desktop grid: 12 columns, `grid-auto-flow: dense`.
- Proposed spans: `5 + 4 + 3` in row 1, `7 + 5` in row 2, `4 + 4 + 4` in row 3.
- Total row widths close exactly at 12 columns. No empty corner cells.

Label and contrast sweep:

- Do not use labels like `SECTION 01`, `QUESTION 05`, or generic metadata labels.
- Dark buttons use off-white text. Light buttons use charcoal text.
- Icon-only controls require accessible labels.

## 7. Proposed Design Tokens

Use CSS variables in `src/styles.css` so all pages share the same system.

```css
:root {
  --font-display: "Outfit", ui-sans-serif, system-ui, sans-serif;
  --font-body: "Outfit", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace;

  --color-canvas: #f7f8f5;
  --color-surface: #ffffff;
  --color-surface-2: #eff2ed;
  --color-ink: #171815;
  --color-ink-soft: #5d625a;
  --color-ink-faint: #81877e;
  --color-border: #d9ded6;
  --color-border-strong: #aeb8ab;
  --color-accent: #2f6f59;
  --color-accent-soft: #dce9e2;
  --color-danger: #a94735;
  --color-rail: #10130f;
  --color-rail-text: #eef3ec;

  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 22px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;

  --shadow-soft: 0 24px 70px rgba(40, 48, 38, 0.10);
  --shadow-inset: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  --motion-fast: 160ms;
  --motion-medium: 260ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

Color notes:

- `--color-accent` is the only accent.
- `--color-rail` is off-black, not pure black.
- The palette borrows the clarity of Refero and the code density of getdesign, but the green specimen/lab identity is distinct.

## 8. Page Architecture

### Home page

Primary goal: convert a URL into an extraction job.

Structure:

1. Sticky navigation.
2. Asymmetric hero:
   - Left: headline, plain product promise, URL/email form.
   - Right: live specimen panel with sample color/type/spacing rows.
3. Token bento:
   - Color strip.
   - Typography scale preview.
   - Spacing/radius ruler.
   - DESIGN.md artifact preview.
   - Brand guide preview.
4. Process section:
   - Paste URL.
   - Extract tokens.
   - Review artifacts.
   - Download DESIGN.md.
5. Payment state:
   - QR block styled as a receipt, not a raw panel.
   - Bank/order details in a compact definition list.
6. Footer:
   - Strong CTA.
   - Terms, privacy, support.

### Status page

Primary goal: make waiting understandable.

States:

- Loading: specimen skeleton, not plain `Loading`.
- Queued: timeline step active at `Queued`.
- Processing: animated token rows using transform/opacity.
- Completed: clear route to preview.
- Failed: direct error with retry/back path.

### Preview page

Primary goal: review extracted design artifacts.

Structure:

1. Artifact toolbar:
   - `tokens.json`
   - `DESIGN.md`
   - `brand-guide.pdf`
2. Color specimens:
   - Large swatches with accessible labels and hex values.
3. Type specimens:
   - Font tokens rendered as readable rows.
4. System metrics:
   - Spacing, radius, shadows in mono/tabular rows.
5. Brand guide viewer:
   - Full-width PDF panel with reserved height.

## 9. Motion Plan

Recommended implementation:

- CSS first for hover, active, skeleton shimmer, and page entrance.
- GSAP only if approved, and only for the pinned process/story section.
- Do not add Framer Motion and GSAP together for this small frontend.

Required dependency if GSAP is approved:

```bash
npm install gsap @gsap/react
```

Optional dependency if icons are needed:

```bash
npm install @phosphor-icons/react
```

Motion rules:

- Animate only `transform` and `opacity`.
- Respect `prefers-reduced-motion`.
- Do not use `window.addEventListener("scroll")`; use GSAP ScrollTrigger cleanup if GSAP is added.
- No `backdrop-filter` on scrolling card lists.
- Fixed grain/noise overlay only, pointer-events none.

## 10. Implementation Approach

Keep changes surgical:

- Update existing files directly first:
  - `src/pages/Home.tsx`
  - `src/pages/Status.tsx`
  - `src/pages/Preview.tsx`
  - `src/styles.css`
- Extract small components only if a file would exceed roughly 200 lines.
- Do not create "enhanced" duplicate pages.
- Keep route paths unchanged.
- Keep API calls unchanged.
- Preserve current tests and add/update tests only where markup/state behavior changes.

Suggested phases:

1. Token foundation:
   - Replace root font/colors/radius/spacing.
   - Add `100dvh`, responsive containers, focus rings, and button states.
   - Verify: `npm run build`.
2. Home website shell:
   - Add nav, hero, specimen panel, token bento, process, footer.
   - Preserve submit/payment logic.
   - Verify: `npm run build` and existing tests.
3. Status and preview polish:
   - Add state-specific skeletons and artifact hierarchy.
   - Preserve polling/download behavior.
   - Verify: `npm run build` and existing tests.
4. Optional GSAP chapter:
   - Add one isolated pinned process section.
   - Add cleanup and reduced-motion fallback.
   - Verify manually in desktop/mobile viewports.

## 11. Success Criteria

- First viewport clearly reads as a website for extracting design tokens from a URL.
- The UI is visibly different from `getdesign.md` and `styles.refero.design`.
- No Inter, no AI purple/blue gradients, no pure black, no emoji-as-icon UI.
- URL extraction, payment polling, job polling, and artifact download behavior still work.
- Mobile layout has no horizontal scroll.
- Full-height sections use `min-height: 100dvh`, not `100vh`.
- Loading, empty, and error states are designed intentionally.
- `npm run build` passes after implementation.

## 12. Review Questions

1. Should the final implementation stay CSS-first, or should the pinned GSAP chapter be included in the first redesign pass?
2. Do you approve the "Specimen Lab for Design Tokens" direction and mineral green accent?
3. Should implementation keep all copy in English, or should the public-facing website support Vietnamese copy too?
