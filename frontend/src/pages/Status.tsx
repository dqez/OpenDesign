import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getJob, type JobResponse } from "../api";
import {
  getClientJob,
  updateClientJobFromResponse,
  type ClientJobRecord,
} from "../client-jobs";

const steps = ["queued", "processing", "completed", "failed"] as const;
const POLL_INTERVAL_MS = 3000;
const DEFAULT_FAILURE_REASON = "Extraction failed. Please try again or start a new request.";

export function Status() {
  const { jobId = "" } = useParams();
  const [job, setJob] = useState<JobResponse | null>(null);
  const [clientJob, setClientJob] = useState<ClientJobRecord | null>(() =>
    getClientJob(jobId),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setClientJob(getClientJob(jobId));
  }, [jobId]);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    async function poll() {
      try {
        const next = await getJob(jobId);
        if (!active) return;

        setJob(next);
        updateClientJobFromResponse(next);
        setClientJob(getClientJob(jobId));

        if (next.status === "queued" || next.status === "processing") {
          timer = window.setTimeout(poll, POLL_INTERVAL_MS);
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
      if (timer) window.clearTimeout(timer);
    };
  }, [jobId]);

  if (error) {
    return (
      <main className="site-shell status-shell">
        <section className="state-panel">
          <p className="section-kicker">Extraction failed</p>
          <h1>Connection failed. Try again.</h1>
          <p className="error">{error}</p>
          <StatusActions jobId={jobId} />
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
          spacing, and artifact layers. You do not need to keep this page open.
        </p>
        {clientJob ? (
          <aside className="status-email-note">
            Results will be sent to <strong>{clientJob.email}</strong>. Go back
            home anytime; the queue card will keep tracking {clientJob.url}.
          </aside>
        ) : null}
        <div className="status-steps" aria-label="Extraction progress">
          {steps.map((step) => (
            <span className={status === step ? "active" : ""} key={step}>
              {step}
            </span>
          ))}
        </div>
        {!job ? <div className="skeleton-lines" aria-hidden="true" /> : null}
        {job?.status === "failed" ? (
          <p className="error" role="alert">
            {job.failureReason ?? DEFAULT_FAILURE_REASON}
          </p>
        ) : null}
        <StatusActions jobId={jobId} isCompleted={job?.status === "completed"} />
      </section>
    </main>
  );
}

function StatusActions({
  jobId,
  isCompleted = false,
}: {
  jobId: string;
  isCompleted?: boolean;
}) {
  return (
    <nav className="status-actions" aria-label="Job actions">
      <Link className="status-link" to="/">
        Back home
      </Link>
      {isCompleted ? (
        <Link className="status-link" to={`/jobs/${jobId}/preview`}>
          Open fullscreen preview
        </Link>
      ) : null}
    </nav>
  );
}
