import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getJob } from "../api";
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

export function ExtractProgressToast() {
  const [jobs, setJobs] = useState<ClientJobRecord[]>(() => getClientJobs());

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

  const visibleJobs = jobs.slice(0, 3);
  if (visibleJobs.length === 0) return null;

  return (
    <aside className="extract-progress-toast" aria-label="Extraction progress">
      <div className="toast-header">
        <p className="section-kicker">Background queue</p>
        <strong>{visibleJobs.length} extraction job</strong>
      </div>
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
      </div>
    </aside>
  );
}
