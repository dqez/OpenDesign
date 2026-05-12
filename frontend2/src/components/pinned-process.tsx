import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const steps = [
  ["Paste URL", "The crawler reads visible UI, computed styles, and page metadata."],
  ["Extract tokens", "Color, type, spacing, radius, and shadow signals are grouped."],
  ["Write artifacts", "tokens.json, DESIGN.md, and the brand guide are prepared."],
  ["Review system", "You inspect the specimen tray before handing it to an agent."],
];

export function PinnedProcess() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      const cards = gsap.utils.toArray<HTMLElement>(".process-card", section);
      gsap.fromTo(
        cards,
        { opacity: 0.45, y: 42, scale: 0.96 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          stagger: 0.18,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top 72%",
            end: "bottom 38%",
            scrub: 0.7,
          },
        },
      );

    },
    { scope: sectionRef },
  );

  return (
    <section className="process-section" id="process" ref={sectionRef}>
      <div className="process-copy">
        <p className="section-kicker">From URL to DESIGN.md</p>
        <h2>One compact pass from website surface to usable design memory.</h2>
        <p>
          Four visible steps, no decorative scroll hijacking, and a
          reduced-motion fallback.
        </p>
      </div>
      <div className="process-stack">
        {steps.map(([title, body]) => (
          <article className="process-card" key={title}>
            <span>{title}</span>
            <p>{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
