import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getDesignCatalog, type DesignCatalogItem } from "../api";
import { DesignPreview } from "../components/design-preview";
import { RawDesignMdPanel } from "../components/raw-design-md-panel";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import {
  fetchJsonArtifact,
  fetchTextArtifact,
  findDesignBySlug,
} from "../design-artifacts";
import {
  createDesignPreviewModel,
  type DesignPreviewModel,
} from "../design-token-parser";

type ActiveTab = "preview" | "design-md";
type DetailTheme = "light" | "dark";

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
  const [tab, setTab] = useState<ActiveTab>(() => tabFromHash());
  const [detailTheme, setDetailTheme] = useState<DetailTheme>("light");
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function syncTabFromHash() {
      setTab(tabFromHash());
    }

    window.addEventListener("hashchange", syncTabFromHash);
    return () => window.removeEventListener("hashchange", syncTabFromHash);
  }, []);

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
    return (
      <DetailStatePanel kicker="DESIGN.md" title="Loading design system" />
    );
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
      <SiteHeader />
      <section className={`design-detail design-detail--${detailTheme}`}>
        <header className="design-detail-header">
          <div className="design-detail-title">
            <p className="section-kicker">DESIGN.md</p>
            <h1>{item.brand}</h1>
            <a className="design-source" href={item.sourceUrl}>
              {item.sourceUrl}
            </a>
            {item.updatedAt ? <time>{formatDate(item.updatedAt)}</time> : null}
          </div>
          <div className="design-detail-summary">
            <span>Token preview</span>
            <strong>{model ? "Ready" : "Raw only"}</strong>
            <p>
              Generated from the latest extracted artifacts in the design
              catalog.
            </p>
          </div>
        </header>

        <div className="design-detail-workspace">
          <aside
            className="design-detail-rail"
            aria-label="Design detail controls"
          >
            <Link className="status-link" to="/">
              Back to catalog
            </Link>

            <nav className="design-tabs" aria-label="Design detail views">
              <a
                className={tab === "preview" ? "active" : ""}
                href="#preview"
                aria-current={tab === "preview" ? "page" : undefined}
                onClick={() => setTab("preview")}
              >
                Preview
              </a>
              <a
                className={tab === "design-md" ? "active" : ""}
                href="#design-md"
                aria-current={tab === "design-md" ? "page" : undefined}
                onClick={() => setTab("design-md")}
              >
                DESIGN.md
              </a>
            </nav>

            <div className="design-detail-actions">
              <div className="design-theme-toggle" aria-label="Design detail theme">
                <button
                  className={detailTheme === "light" ? "active" : ""}
                  type="button"
                  aria-pressed={detailTheme === "light"}
                  onClick={() => setDetailTheme("light")}
                >
                  Light
                </button>
                <button
                  className={detailTheme === "dark" ? "active" : ""}
                  type="button"
                  aria-pressed={detailTheme === "dark"}
                  onClick={() => setDetailTheme("dark")}
                >
                  Dark
                </button>
              </div>
              <button
                type="button"
                onClick={() => copyMarkdown(markdown)}
                disabled={!markdown}
              >
                {copied ? "Copied" : "Copy DESIGN.md"}
              </button>
              {item.designMdUrl ? (
                <a className="status-link" href={item.designMdUrl} download>
                  Download
                </a>
              ) : null}
              {item.brandGuideUrl ? (
                <a className="status-link" href={item.brandGuideUrl}>
                  Brand guide
                </a>
              ) : null}
            </div>
          </aside>

          <div className="design-detail-main">
            {tab === "preview" ? (
              <DesignPreview
                brand={item.brand}
                sourceUrl={item.sourceUrl}
                model={model}
                mode={detailTheme}
              />
            ) : (
              <RawDesignMdPanel
                markdown={markdown}
                downloadUrl={item.designMdUrl}
              />
            )}
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

function tabFromHash(): ActiveTab {
  if (typeof window === "undefined") return "preview";
  return window.location.hash === "#design-md" ? "design-md" : "preview";
}

function DetailStatePanel({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body?: string;
}) {
  return (
    <main className="site-shell preview-layout">
      <SiteHeader />
      <section className="state-panel">
        <p className="section-kicker">{kicker}</p>
        <h1>{title}</h1>
        {body ? (
          <p>{body}</p>
        ) : (
          <div className="skeleton-lines" aria-hidden="true" />
        )}
        <Link className="status-link" to="/">
          Back to catalog
        </Link>
      </section>
      <SiteFooter />
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
