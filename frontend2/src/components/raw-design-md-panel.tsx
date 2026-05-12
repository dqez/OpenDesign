import { useState } from "react";

type Props = {
  markdown: string | null;
  downloadUrl?: string;
};

export function RawDesignMdPanel({ markdown, downloadUrl }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyMarkdown() {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.warn("Copy failed", err);
    }
  }

  return (
    <section className="raw-design-panel">
      <div className="raw-design-toolbar">
        <div>
          <p className="section-kicker">Raw artifact</p>
          <h2>DESIGN.md</h2>
        </div>
        <div className="raw-design-actions">
          <button type="button" onClick={copyMarkdown} disabled={!markdown}>
            {copied ? "Copied" : "Copy"}
          </button>
          {downloadUrl ? (
            <a className="status-link" href={downloadUrl} download>
              Download
            </a>
          ) : null}
        </div>
      </div>

      {markdown ? (
        <pre className="raw-design-code">{markdown}</pre>
      ) : (
        <div className="design-preview-empty">
          <p className="section-kicker">Unavailable</p>
          <h2>DESIGN.md is not available for this brand.</h2>
        </div>
      )}
    </section>
  );
}
