import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getJob, type JobResponse } from "../api";

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
      <main className="app-shell">
        <p className="error">{error}</p>
      </main>
    );
  }
  if (!job) return <main className="app-shell">Loading</main>;

  return (
    <main className="app-shell">
      <section className="status-panel">
        <p className="eyebrow">Job {jobId}</p>
        <h1>{job.status}</h1>
        {job.status === "completed" ? (
          <Link className="status-link" to={`/jobs/${jobId}/preview`}>
            Open preview
          </Link>
        ) : null}
        {job.status === "failed" ? (
          <p className="error">{job.failureReason}</p>
        ) : null}
      </section>
    </main>
  );
}
