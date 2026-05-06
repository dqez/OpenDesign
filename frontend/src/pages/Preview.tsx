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

export function flattenTokens(
  tree: TokenTree,
  prefix = "",
): Array<{ name: string; value: unknown; type?: string }> {
  return Object.entries(tree).flatMap(([key, raw]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    const token = raw as TokenValue;
    if ("value" in token || "$value" in token) {
      return [
        {
          name,
          value: token.value ?? token.$value,
          type: token.type ?? token.$type,
        },
      ];
    }
    return flattenTokens(raw as TokenTree, name);
  });
}

function isColor(value: unknown) {
  return typeof value === "string" && /^#([0-9a-f]{3,8})$/i.test(value);
}

export function Preview() {
  const { jobId = "" } = useParams();
  const [job, setJob] = useState<JobResponse | null>(null);
  const [tokens, setTokens] = useState<
    Array<{ name: string; value: unknown; type?: string }>
  >([]);
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
      <main className="app-shell">
        <p className="error">{error}</p>
      </main>
    );
  }
  if (!job?.files) return <main className="app-shell">No files available</main>;

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
    <main className="app-shell preview-layout">
      <section className="preview-toolbar">
        <h1>Extraction preview</h1>
        <nav className="download-list">
          {job.files.tokens?.url ? <a href={job.files.tokens.url}>tokens.json</a> : null}
          {job.files.designMd?.url ? <a href={job.files.designMd.url}>DESIGN.md</a> : null}
          {job.files.brandGuide?.url ? (
            <a href={job.files.brandGuide.url}>brand-guide.pdf</a>
          ) : null}
        </nav>
      </section>

      <section className="token-section">
        <h2>Colors</h2>
        <div className="color-grid">
          {colors.map((token) => (
            <article className="color-token" key={token.name}>
              <span
                className="swatch"
                style={{ background: String(token.value) }}
              />
              <strong>{token.name}</strong>
              <code>{String(token.value)}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="token-section">
        <h2>Typography</h2>
        <div className="token-list">
          {typography.map((token) => (
            <article key={token.name}>
              <strong>{token.name}</strong>
              <code>{JSON.stringify(token.value)}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="token-section">
        <h2>Spacing, radius, shadows</h2>
        <div className="token-list">
          {[...spacing, ...effects].map((token) => (
            <article key={token.name}>
              <strong>{token.name}</strong>
              <code>{JSON.stringify(token.value)}</code>
            </article>
          ))}
        </div>
      </section>

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
