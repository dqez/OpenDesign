import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getJob, type JobResponse } from "../api";
import { DesignPreview } from "../components/design-preview";
import { RawDesignMdPanel } from "../components/raw-design-md-panel";
import { getClientJob, updateClientJobFromResponse } from "../client-jobs";
import { fetchJsonArtifact, fetchTextArtifact } from "../design-artifacts";
import {
  createDesignPreviewModel,
  type DesignPreviewModel,
} from "../design-token-parser";

export function Preview() {
  const { jobId = "" } = useParams();
  const [job, setJob] = useState<JobResponse | null>(null);
  const [model, setModel] = useState<DesignPreviewModel | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const next = await getJob(jobId);
        const [tokens, designMd] = await Promise.all([
          fetchJsonArtifact(next.files?.tokens?.url),
          fetchTextArtifact(next.files?.designMd?.url),
        ]);
        if (!active) return;

        setJob(next);
        setMarkdown(designMd);
        setModel(tokens ? createDesignPreviewModel(tokens) : null);
        updateClientJobFromResponse(next);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Preview failed");
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [jobId]);

  if (error) {
    return (
      <main className="site-shell preview-layout">
        <section className="state-panel">
          <p className="section-kicker">Artifact preview</p>
          <h1>Preview failed.</h1>
          <p className="error">{error}</p>
          <Link className="status-link" to="/">
            Back home
          </Link>
        </section>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="site-shell preview-layout">
        <section className="state-panel">
          <p className="section-kicker">Artifact preview</p>
          <h1>Loading fullscreen preview</h1>
          <p>The extraction job is publishing its design artifacts.</p>
          <div className="skeleton-lines" aria-hidden="true" />
        </section>
      </main>
    );
  }

  const clientJob = getClientJob(jobId);
  const brand = clientJob?.url ? hostname(clientJob.url) : `Job ${jobId}`;
  const sourceUrl = clientJob?.url ?? `/jobs/${jobId}`;

  return (
    <main className="job-preview-shell">
      <section className="job-preview-toolbar">
        <div>
          <p className="section-kicker">Fullscreen preview</p>
          <h1>{brand}</h1>
        </div>
        <nav className="download-list" aria-label="Preview actions">
          <Link to="/">Back home</Link>
          <Link to={`/jobs/${jobId}`}>Job status</Link>
          {job.files?.tokens?.url ? <a href={job.files.tokens.url}>tokens.json</a> : null}
          {job.files?.designMd?.url ? <a href={job.files.designMd.url}>DESIGN.md</a> : null}
          {job.files?.brandGuide?.url ? (
            <a href={job.files.brandGuide.url}>brand-guide.pdf</a>
          ) : null}
        </nav>
      </section>

      <DesignPreview brand={brand} sourceUrl={sourceUrl} model={model} mode="light" />

      {job.files?.designMd?.url ? (
        <RawDesignMdPanel markdown={markdown} downloadUrl={job.files.designMd.url} />
      ) : null}
    </main>
  );
}

function hostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
