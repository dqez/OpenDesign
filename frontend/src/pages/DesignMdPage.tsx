import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getDesignCatalog, type DesignCatalogItem } from "../api";
import { DesignPreview } from "../components/design-preview";
import { RawDesignMdPanel } from "../components/raw-design-md-panel";
import {
  fetchJsonArtifact,
  fetchTextArtifact,
  findDesignBySlug,
} from "../design-artifacts";
import { createDesignPreviewModel, type DesignPreviewModel } from "../design-token-parser";

type ActiveTab = "preview" | "design-md";

type DetailState =
  | { status: "loading" }
  | { status: "not-found" }
  | {
      status: "ready";
      item: DesignCatalogItem;
      markdown: string | null;
      model: DesignPreviewModel | null;
    }
  | { status: "failed" };

export function DesignMdPage() {
  const { brand = "" } = useParams();
  const [tab, setTab] = useState<ActiveTab>("preview");
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setState({ status: "loading" });
      try {
        const catalog = await getDesignCatalog();
        const item = findDesignBySlug(catalog, brand);
        if (!item) {
          if (active) setState({ status: "not-found" });
          return;
        }

        const [markdown, tokens] = await Promise.all([
          fetchTextArtifact(item.designMdUrl),
          fetchJsonArtifact(item.tokensUrl),
        ]);

        if (active) {
          setState({
            status: "ready",
            item,
            markdown,
            model: tokens ? createDesignPreviewModel(tokens) : null,
          });
        }
      } catch (err) {
        console.warn("Design detail failed to load", err);
        if (active) setState({ status: "failed" });
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [brand]);

  async function copyMarkdown(markdown: string | null) {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.warn("Copy failed", err);
    }
  }

  if (state.status === "loading") {
    return <DetailStatePanel kicker="DESIGN.md" title="Loading design system" />;
  }

  if (state.status === "not-found") {
    return (
      <DetailStatePanel
        kicker="Missing brand"
        title="This design file is not in the catalog."
        body="Return to the catalog and choose an available brand."
      />
    );
  }

  if (state.status === "failed") {
    return (
      <DetailStatePanel
        kicker="Design file"
        title="This design file is not ready to view."
        body="Try another brand from the catalog."
      />
    );
  }

  const { item, markdown, model } = state;

  return (
    <main className="site-shell">
      <section className="design-detail">
        <header className="design-detail-header">
          <div className="design-detail-bar">
            <Link className="brand-mark" to="/">2Design</Link>
            <Link className="status-link" to="/">Back to catalog</Link>
          </div>

          <div className="design-detail-title">
            <p className="section-kicker">DESIGN.md</p>
            <h1>{item.brand}</h1>
            <a className="design-source" href={item.sourceUrl}>
              {item.sourceUrl}
            </a>
            {item.updatedAt ? <time>{formatDate(item.updatedAt)}</time> : null}
          </div>

          <div className="design-detail-actions">
            <button type="button" onClick={() => copyMarkdown(markdown)} disabled={!markdown}>
              {copied ? "Copied" : "Copy DESIGN.md"}
            </button>
            {item.designMdUrl ? (
              <a className="status-link" href={item.designMdUrl} download>
                Download DESIGN.md
              </a>
            ) : null}
            {item.brandGuideUrl ? (
              <a className="status-link" href={item.brandGuideUrl}>
                Brand guide
              </a>
            ) : null}
          </div>
        </header>

        <nav className="design-tabs" aria-label="Design detail views">
          <button
            className={tab === "preview" ? "active" : ""}
            type="button"
            onClick={() => setTab("preview")}
          >
            Preview
          </button>
          <button
            className={tab === "design-md" ? "active" : ""}
            type="button"
            onClick={() => setTab("design-md")}
          >
            DESIGN.md
          </button>
        </nav>

        {tab === "preview" ? (
          <DesignPreview brand={item.brand} sourceUrl={item.sourceUrl} model={model} />
        ) : (
          <RawDesignMdPanel markdown={markdown} downloadUrl={item.designMdUrl} />
        )}
      </section>
    </main>
  );
}

function DetailStatePanel({ kicker, title, body }: { kicker: string; title: string; body?: string }) {
  return (
    <main className="site-shell preview-layout">
      <section className="state-panel">
        <p className="section-kicker">{kicker}</p>
        <h1>{title}</h1>
        {body ? <p>{body}</p> : <div className="skeleton-lines" aria-hidden="true" />}
        <Link className="status-link" to="/">Back to catalog</Link>
      </section>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
