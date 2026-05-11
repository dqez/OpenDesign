import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getJob, type JobResponse } from "../api";
import {
  getClientJob,
  updateClientJobFromResponse,
  type ClientJobRecord,
} from "../client-jobs";

const POLL_INTERVAL_MS = 3000;
const DEFAULT_FAILURE_REASON =
  "Extraction failed. Please try again or start a new request.";

const statusDetails = {
  queued: {
    label: "Queued",
    title: "Waiting for a crawler slot",
    message:
      "Your request is safely in the queue. You can go home and keep tracking it from the corner card.",
    icon: "○",
    isLoading: true,
  },
  processing: {
    label: "Processing",
    title: "Extracting design tokens",
    message:
      "The crawler is reading the site and separating colors, typography, spacing, and downloadable artifacts.",
    icon: "◌",
    isLoading: true,
  },
  completed: {
    label: "Completed",
    title: "Preview is ready",
    message:
      "The extraction finished. Open the fullscreen preview or download the generated artifacts.",
    icon: "✓",
    isLoading: false,
  },
  failed: {
    label: "Failed",
    title: "Extraction could not finish",
    message:
      "The crawler could not complete this job. Start a new request or try another URL.",
    icon: "!",
    isLoading: false,
  },
} satisfies Record<
  JobResponse["status"],
  {
    label: string;
    title: string;
    message: string;
    icon: string;
    isLoading: boolean;
  }
>;

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
        <BackHomeLink />
        <section className="state-panel status-panel">
          <p className="section-kicker">Extraction failed</p>
          <h1>Connection failed. Try again.</h1>
          <p className="error">{error}</p>
        </section>
      </main>
    );
  }

  const status = job?.status ?? "queued";
  const details = statusDetails[status];

  return (
    <main className="site-shell status-shell">
      <BackHomeLink />
      <section className="state-panel status-panel">
        <p className="section-kicker">Job {jobId}</p>
        <h1>{job ? details.title : "Preparing specimen tray"}</h1>
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
        <StatusCurrentState status={status} details={details} />
        {!job ? <div className="skeleton-lines" aria-hidden="true" /> : null}
        {job?.status === "failed" ? (
          <p className="error" role="alert">
            {job.failureReason ?? DEFAULT_FAILURE_REASON}
          </p>
        ) : null}
        <StatusActions
          jobId={jobId}
          isCompleted={job?.status === "completed"}
        />
      </section>
    </main>
  );
}

function BackHomeLink() {
  return (
    <Link className="status-back-home" to="/">
      Back home
    </Link>
  );
}

type StatusDetails = (typeof statusDetails)[JobResponse["status"]];

function StatusCurrentState({
  status,
  details,
}: {
  status: JobResponse["status"];
  details: StatusDetails;
}) {
  return (
    <section
      className={`status-current status-current-${status}`}
      aria-live="polite"
    >
      <span
        className={details.isLoading ? "status-spinner" : "status-icon"}
        aria-hidden="true"
      >
        <span className="icon-shift">{details.icon}</span>
      </span>
      <div>
        <p>{details.label}</p>
        <strong>{details.title}</strong>
        <span>{details.message}</span>
      </div>
    </section>
  );
}

function StatusActions({
  jobId,
  isCompleted = false,
}: {
  jobId: string;
  isCompleted?: boolean;
}) {
  if (!isCompleted) return null;

  return (
    <nav className="status-actions" aria-label="Job actions">
      <Link className="status-link" to={`/jobs/${jobId}/preview`}>
        Open fullscreen preview
      </Link>
    </nav>
  );
}
