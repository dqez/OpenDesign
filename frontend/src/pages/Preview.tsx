import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getJob, type JobResponse } from "../api";

type TokenValue = {
  value?: unknown;
  type?: string;
  $value?: unknown;
  $type?: string;
};
export interface TokenTree {
  [key: string]: TokenValue | TokenTree;
}

type FlatToken = { name: string; value: unknown; type?: string };

export function flattenTokens(
  tree: TokenTree | unknown,
  prefix = "",
): FlatToken[] {
  if (!isRecord(tree)) return [];

  return Object.entries(tree).flatMap(([key, raw]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    if (!isRecord(raw)) return [];

    const token = raw as TokenValue;
    if ("value" in token || "$value" in token) {
      return [{ name, value: token.value ?? token.$value, type: token.type ?? token.$type }];
    }
    return flattenTokens(raw as TokenTree, name);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isColor(value: unknown) {
  return typeof value === "string" && /^#([0-9a-f]{3,8})$/i.test(value);
}

export function Preview() {
  const { jobId = "" } = useParams();
  const [job, setJob] = useState<JobResponse | null>(null);
  const [tokens, setTokens] = useState<FlatToken[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const next = await getJob(jobId);
        setJob(next);
        if (next.files?.tokens?.url) {
          const response = await fetch(next.files.tokens.url);
          const tokenJson = (await response.json()) as TokenTree;
          setTokens(flattenTokens(tokenJson));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Preview failed");
      }
    }
    void load();
  }, [jobId]);

  if (error) {
    return (
      <main className="site-shell preview-layout">
        <section className="state-panel">
          <p className="section-kicker">Artifact preview</p>
          <h1>Preview failed.</h1>
          <p className="error">{error}</p>
        </section>
      </main>
    );
  }

  if (!job?.files) {
    return (
      <main className="site-shell preview-layout">
        <section className="state-panel">
          <p className="section-kicker">Artifact preview</p>
          <h1>No files available yet</h1>
          <p>The extraction job has not published tokens or guide files.</p>
          <div className="skeleton-lines" aria-hidden="true" />
        </section>
      </main>
    );
  }

  const colors = tokens.filter((token) => isColor(token.value));
  const typography = tokens.filter(
    (token) =>
      token.name.toLowerCase().includes("font") || token.type === "typography",
  );
  const spacing = tokens.filter(
    (token) =>
      token.name.toLowerCase().includes("spacing") ||
      token.name.toLowerCase().includes("space"),
  );
  const effects = tokens.filter(
    (token) =>
      token.name.toLowerCase().includes("shadow") ||
      token.name.toLowerCase().includes("radius"),
  );

  return (
    <main className="site-shell preview-layout">
      <section className="preview-toolbar">
        <div>
          <p className="section-kicker">Artifact preview</p>
          <h1>Extracted design memory</h1>
        </div>
        <nav className="download-list" aria-label="Download artifacts">
          {job.files.tokens?.url ? <a href={job.files.tokens.url}>tokens.json</a> : null}
          {job.files.designMd?.url ? <a href={job.files.designMd.url}>DESIGN.md</a> : null}
          {job.files.brandGuide?.url ? (
            <a href={job.files.brandGuide.url}>brand-guide.pdf</a>
          ) : null}
        </nav>
      </section>

      <section className="token-section">
        <h2>Color specimens</h2>
        <div className="color-grid">
          {colors.map((token) => (
            <article className="color-token" key={token.name}>
              <span className="swatch" style={{ background: String(token.value) }} />
              <strong>{token.name}</strong>
              <code>{String(token.value)}</code>
            </article>
          ))}
          {colors.length === 0 ? <p>No color tokens detected.</p> : null}
        </div>
      </section>

      <TokenList title="Type specimens" tokens={typography} />
      <TokenList title="Spacing, radius, shadows" tokens={[...spacing, ...effects]} />

      {job.files.brandGuide?.url ? (
        <iframe
          className="brand-guide"
          title="Brand guide"
          src={job.files.brandGuide.url}
        />
      ) : null}
    </main>
  );
}

function TokenList({ title, tokens }: { title: string; tokens: FlatToken[] }) {
  return (
    <section className="token-section">
      <h2>{title}</h2>
      <div className="token-list">
        {tokens.map((token) => (
          <article key={token.name}>
            <strong>{token.name}</strong>
            <code>{JSON.stringify(token.value)}</code>
          </article>
        ))}
        {tokens.length === 0 ? <p>No matching tokens detected.</p> : null}
      </div>
    </section>
  );
}
