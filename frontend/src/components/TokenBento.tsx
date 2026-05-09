import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const swatches = [
  "#171815",
  "#2f6f59",
  "#dce9e2",
  "#eff2ed",
  "#81877e",
  "#a94735",
  "#10130f",
  "#ffffff",
];

const spacingSamples = [
  { width: "18px", label: "4px" },
  { width: "38px", label: "8px" },
  { width: "74px", label: "16px" },
  { width: "100%", label: "24px" },
];

export function TokenBento() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      const cards = gsap.utils.toArray<HTMLElement>(".bento-card", section);
      gsap.fromTo(
        cards,
        { opacity: 0, y: 34, scale: 0.98 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.72,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: {
            trigger: section,
            start: "top 78%",
            toggleActions: "play none none reverse",
          },
        },
      );
    },
    { scope: sectionRef },
  );

  return (
    <section className="bento-section" id="output" ref={sectionRef}>
      <div className="section-wrap">
        <div className="bento-heading">
          <p className="section-kicker">What you get</p>
          <h2>Reviewable artifacts, not a raw scrape.</h2>
        </div>
        <div className="bento-grid">
          <article className="bento-card bento-5">
            <h3>Colors</h3>
            <p>Every color extracted as named tokens with practical contrast context.</p>
            <div className="mini-swatches">
              {swatches.map((color) => (
                <span
                  aria-label={`Color specimen ${color}`}
                  className="mini-swatch"
                  key={color}
                  style={{ background: color }}
                />
              ))}
            </div>
          </article>

          <article className="bento-card bento-4">
            <h3>Typography</h3>
            <p>Font families, weights, sizes, and line heights in a usable scale.</p>
            <div className="type-specimen">
              <SpecimenRow label="display · 48px" size="2rem" weight={700} />
              <SpecimenRow label="body · 16px" size="1rem" weight={400} />
              <SpecimenRow label="mono · 12px" mono size="0.78rem" weight={600} />
            </div>
          </article>

          <article className="bento-card bento-3">
            <h3>Spacing</h3>
            <p>Spacing scale, radii, and surface rhythm.</p>
            <div className="spacing-ruler">
              {spacingSamples.map((sample) => (
                <div className="spacing-bar" key={sample.label}>
                  <span className="spacing-bar-fill" style={{ width: sample.width }} />
                  <span className="spacing-bar-label">{sample.label}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="bento-card bento-7">
            <h3>DESIGN.md</h3>
            <p>A structured markdown document ready to drop into your repository.</p>
            <pre className="code-preview" aria-label="DESIGN.md preview">
              <code>{`# Design System

## Colors
ink: #171815
accent: #2f6f59

## Typography
font-display: Outfit
font-mono: JetBrains Mono`}</code>
            </pre>
          </article>

          <article className="bento-card bento-5">
            <h3>Brand guide</h3>
            <p>PDF specimens, usage rules, and component notes generated from tokens.</p>
            <div className="pdf-chip">brand-guide.pdf</div>
          </article>
        </div>
      </div>
    </section>
  );
}

function SpecimenRow({
  label,
  mono = false,
  size,
  weight,
}: {
  label: string;
  mono?: boolean;
  size: string;
  weight: number;
}) {
  return (
    <div className="type-specimen-row">
      <span
        className="type-specimen-preview"
        style={{
          fontFamily: mono ? "var(--font-mono)" : "var(--font-display)",
          fontSize: size,
          fontWeight: weight,
        }}
      >
        Aa
      </span>
      <span className="type-specimen-label">{label}</span>
    </div>
  );
}
