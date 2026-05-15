import { type ReactNode } from "react";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";

type LegalPageProps = {
  eyebrow: string;
  title: string;
  summary: string;
  updatedAt?: string;
  children: ReactNode;
  aside?: ReactNode;
};

export function LegalPage({
  aside,
  children,
  eyebrow,
  summary,
  title,
  updatedAt,
}: LegalPageProps) {
  return (
    <main className="site-shell legal-shell">
      <SiteHeader />
      <section className="legal-page">
        <header className="legal-hero">
          <p className="section-kicker">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{summary}</p>
          {updatedAt ? <span>Last updated: {updatedAt}</span> : null}
        </header>

        <div className="legal-layout">
          <article className="legal-article">{children}</article>
          {aside ? <aside className="legal-aside">{aside}</aside> : null}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

export function LegalSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalFactList({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <dl className="legal-fact-list">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
