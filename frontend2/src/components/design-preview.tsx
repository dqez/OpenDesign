import type { CSSProperties, ReactNode } from "react";
import type { DesignPreviewModel } from "../design-token-parser";

type Props = {
  brand: string;
  sourceUrl: string;
  model: DesignPreviewModel | null;
  mode?: "light" | "dark";
};

const cards = [
  ["Magazine", "Design language in motion", "A compact editorial system for product, story, and launch surfaces."],
  ["Components", "Interface primitives", "Buttons, cards, forms, and rails tuned from the extracted token set."],
  ["System", "Reusable brand memory", "A practical preview for agent handoff and frontend exploration."],
];

const specs = [
  ["80", "Display scale"],
  ["1px", "Hairline"],
  ["4", "Core sections"],
  ["AA", "Contrast target"],
];

export function DesignPreview({ brand, sourceUrl, model, mode = "dark" }: Props) {
  if (!model) {
    return (
      <section className="design-preview-empty">
        <p className="section-kicker">Preview</p>
        <h2>Token preview is not ready for this brand.</h2>
        <p>The raw DESIGN.md file is still available in the next tab.</p>
      </section>
    );
  }

  const colors = model.colors.slice(0, 12);
  const theme = buildTheme(model, mode);

  return (
    <article className="design-preview" style={theme}>
      <section className="dp-hero">
        <p className="dp-kicker">Design System Inspiration of {brand}</p>
        <h2>{brand} interface language</h2>
        <p>
          A token-driven specimen generated from {sourceUrl}. It translates the
          extracted palette, type, radius, spacing, and component clues into a
          usable interface preview.
        </p>
        <div className="dp-actions">
          <button type="button">Discover system</button>
          <button type="button" className="dp-outline">Configure</button>
        </div>
      </section>

      <div className="dp-section-grid">
        <PreviewSection index="01" title="Color Palette">
          <div className="dp-color-grid">
            {colors.map((color) => (
              <div className="dp-swatch" key={`${color.name}-${color.hex}`}>
                <span style={{ background: color.hex }} />
                <strong>{label(color.name)}</strong>
                <code>{color.hex}</code>
              </div>
            ))}
          </div>
        </PreviewSection>

        <PreviewSection index="02" title="Typography Scale">
          <div className="dp-type-list">
            {model.typography.slice(0, 6).map((type) => (
              <div key={type.name}>
                <span>{label(type.name)}</span>
                <strong style={sampleTypeStyle(type, 34)}>Aa {brand}</strong>
                <code>{[type.fontSize, type.fontWeight, type.lineHeight].filter(Boolean).join(" / ")}</code>
              </div>
            ))}
          </div>
        </PreviewSection>

        <PreviewSection index="03" title="Button Variants">
          <div className="dp-button-row">
            <button type="button">Primary action</button>
            <button type="button" className="dp-outline">Outline action</button>
            <a href={sourceUrl}>Text link</a>
            <button type="button" className="dp-icon">›</button>
          </div>
        </PreviewSection>

        <PreviewSection index="04" title="Cards & Containers">
          <div className="dp-card-grid">
            {cards.map(([kicker, title, body]) => (
              <article key={title}>
                <p>{kicker}</p>
                <h3>{title}</h3>
                <span>{body}</span>
              </article>
            ))}
          </div>
        </PreviewSection>

        <PreviewSection index="05" title="Spec Cells">
          <div className="dp-spec-grid">
            {specs.map(([value, name]) => (
              <div key={name}>
                <strong>{value}</strong>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </PreviewSection>

        <PreviewSection index="06" title="Form Elements">
          <div className="dp-form-grid">
            <input value="you@example.com" readOnly aria-label="Email example" />
            <input value="Focused input" readOnly aria-label="Focused example" />
            <textarea value="Tell us about your design system..." readOnly aria-label="Inquiry example" />
            <div className="dp-form-note">
              <strong>Cookies on {brand}.</strong>
              <p>We use cookies to improve the browsing experience.</p>
            </div>
          </div>
        </PreviewSection>
      </div>
    </article>
  );
}

function PreviewSection({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  return (
    <section className="dp-section">
      <p className="dp-kicker">{index} — {title}</p>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function buildTheme(model: DesignPreviewModel, mode: "light" | "dark"): CSSProperties {
  const colors = model.colors.map((color) => color.hex);
  const dark = colors.find((hex) => luminance(hex) < 0.08) ?? "#0f1115";
  const light = colors.find((hex) => luminance(hex) > 0.82) ?? "#ffffff";
  const accent = colors.find((hex) => luminance(hex) > 0.12 && luminance(hex) < 0.72) ?? "#2f6f59";
  const radius = model.radii.find((item) => item.value > 0)?.css ?? "8px";
  const background = mode === "light" ? light : dark;
  const ink = mode === "light" ? dark : light;

  return {
    "--dp-bg": background,
    "--dp-surface": mix(background, ink, mode === "light" ? 0.04 : 0.09),
    "--dp-card": mix(background, ink, mode === "light" ? 0.08 : 0.15),
    "--dp-ink": ink,
    "--dp-muted": mix(background, ink, mode === "light" ? 0.54 : 0.68),
    "--dp-accent": accent,
    "--dp-radius": radius,
  } as CSSProperties;
}

function sampleTypeStyle(type?: { fontFamily?: string; fontSize?: string; fontWeight?: string | number; lineHeight?: string | number }, max = 56) {
  const size = type?.fontSize ? clampDimension(type.fontSize, 16, max) : undefined;
  return {
    fontFamily: cleanFont(type?.fontFamily),
    fontSize: size,
    fontWeight: type?.fontWeight,
    lineHeight: type?.lineHeight,
  } as CSSProperties;
}

function clampDimension(value: string, min: number, max: number) {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return value;
  return `${Math.min(Math.max(numeric, min), max)}px`;
}

function cleanFont(value?: string) {
  return value?.replace(/[{}]/g, "").split(".").at(-1);
}

function label(value: string) {
  return value.split(".").at(-1)?.replaceAll("-", " ") ?? value;
}

function luminance(hex: string) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const [r, g, b] = [0, 2, 4].map((start) => parseInt(full.slice(start, start + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mix(a: string, b: string, amount: number) {
  const ca = channels(a);
  const cb = channels(b);
  const mixed = ca.map((value, index) => Math.round(value + (cb[index] - value) * amount));
  return `rgb(${mixed.join(" ")})`;
}

function channels(hex: string) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  return [0, 2, 4].map((start) => parseInt(full.slice(start, start + 2), 16));
}
