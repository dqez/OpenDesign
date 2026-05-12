import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getJob } from "../api";
import { getToastCollapsedStorageKey } from "../app-config";
import {
  CLIENT_JOBS_CHANGED_EVENT,
  getClientJobs,
  removeClientJob,
  updateClientJobFromResponse,
  type ClientJobRecord,
} from "../client-jobs";

const ACTIVE_STATUSES = new Set<ClientJobRecord["status"]>([
  "queued",
  "processing",
]);
const POLL_INTERVAL_MS = 5000;
const TOAST_COLLAPSED_STORAGE_KEY = getToastCollapsedStorageKey();

function getInitialCollapsedState(): boolean {
  if (typeof window === "undefined" || !("sessionStorage" in window)) {
    return false;
  }

  try {
    return window.sessionStorage.getItem(TOAST_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function ExtractProgressToast() {
  const [jobs, setJobs] = useState<ClientJobRecord[]>(() => getClientJobs());
  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsedState);

  useEffect(() => {
    function syncJobs() {
      setJobs(getClientJobs());
    }

    window.addEventListener(CLIENT_JOBS_CHANGED_EVENT, syncJobs);
    window.addEventListener("storage", syncJobs);
    return () => {
      window.removeEventListener(CLIENT_JOBS_CHANGED_EVENT, syncJobs);
      window.removeEventListener("storage", syncJobs);
    };
  }, []);

  const activeJobs = useMemo(
    () => jobs.filter((job) => ACTIVE_STATUSES.has(job.status)),
    [jobs],
  );
  const visibleJobs = jobs.slice(0, 3);
  const hiddenJobCount = Math.max(jobs.length - visibleJobs.length, 0);

  useEffect(() => {
    if (activeJobs.length === 0) return;

    let cancelled = false;
    async function pollJobs() {
      const responses = await Promise.allSettled(
        activeJobs.map((job) => getJob(job.jobId)),
      );
      if (cancelled) return;

      responses.forEach((response) => {
        if (response.status === "fulfilled") {
          updateClientJobFromResponse(response.value);
        }
      });
      setJobs(getClientJobs());
    }

    void pollJobs();
    const timer = window.setInterval(pollJobs, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeJobs]);

  if (visibleJobs.length === 0) return null;

  function toggleCollapsed(): void {
    setIsCollapsed((current) => {
      const next = !current;
      if (typeof window !== "undefined" && "sessionStorage" in window) {
        try {
          window.sessionStorage.setItem(
            TOAST_COLLAPSED_STORAGE_KEY,
            String(next),
          );
        } catch {
          // Ignore unavailable storage; the in-memory collapsed state still applies.
        }
      }
      return next;
    });
  }

  return (
    <aside
      className={`extract-progress-toast${isCollapsed ? " is-collapsed" : ""}`}
      aria-label="Extraction progress"
    >
      <div className="toast-header">
        <div>
          <p className="section-kicker">Background queue</p>
          <strong>{jobs.length} extraction job</strong>
        </div>
        <button
          className="toast-toggle"
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? "Show" : "Hide"}
        </button>
      </div>
      {isCollapsed ? (
        <p className="toast-collapsed-summary">
          {activeJobs.length > 0
            ? `${activeJobs.length} job still running`
            : "Queue is ready"}
        </p>
      ) : (
        <div className="toast-job-list">
          {visibleJobs.map((job) => (
            <article className="toast-job" key={job.jobId}>
              <div>
                <strong>{job.url}</strong>
                <p>
                  {job.status} · Results will be sent to {job.email}
                </p>
              </div>
              <div className="toast-actions">
                <Link to={`/jobs/${job.jobId}`}>View status</Link>
                {job.status === "completed" ? (
                  <Link to={`/jobs/${job.jobId}/preview`}>Open preview</Link>
                ) : null}
                {job.status === "completed" || job.status === "failed" ? (
                  <button type="button" onClick={() => removeClientJob(job.jobId)}>
                    Dismiss
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {hiddenJobCount > 0 ? (
            <p className="toast-overflow-note">+{hiddenJobCount} more in queue</p>
          ) : null}
        </div>
      )}
    </aside>
  );
}
