import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getJob, type JobResponse } from "../api";

const steps = ["queued", "processing", "completed"] as const;

export function Status() {
  const { jobId = "" } = useParams();
  const [job, setJob] = useState<JobResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const next = await getJob(jobId);
        if (!active) return;
        setJob(next);
        if (next.status === "queued" || next.status === "processing") {
          window.setTimeout(poll, 3000);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Polling failed");
        }
      }
    }
    void poll();
    return () => {
      active = false;
    };
  }, [jobId]);

  if (error) {
    return (
      <main className="site-shell status-shell">
        <section className="state-panel">
          <p className="section-kicker">Extraction failed</p>
          <h1>Connection failed. Try again.</h1>
          <p className="error">{error}</p>
          <Link className="status-link" to="/">
            Back to extraction
          </Link>
        </section>
      </main>
    );
  }

  const status = job?.status ?? "queued";

  return (
    <main className="site-shell status-shell">
      <section className="state-panel">
        <p className="section-kicker">Job {jobId}</p>
        <h1>{job ? `Extraction ${job.status}` : "Preparing specimen tray"}</h1>
        <p>
          The crawler is separating the website into reviewable color, type,
          spacing, and artifact layers.
        </p>
        <div className="status-steps" aria-label="Extraction progress">
          {steps.map((step) => (
            <span className={status === step ? "active" : ""} key={step}>
              {step}
            </span>
          ))}
        </div>
        {!job ? <div className="skeleton-lines" aria-hidden="true" /> : null}
        {job?.status === "completed" ? (
          <Link className="status-link" to={`/jobs/${jobId}/preview`}>
            Open preview
          </Link>
        ) : null}
        {job?.status === "failed" ? (
          <p className="error">{job.failureReason}</p>
        ) : null}
      </section>
    </main>
  );
}
