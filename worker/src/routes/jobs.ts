import { Hono } from "hono";
import { getJob } from "../services/db";
import { createSignedFileUrls, type R2Files } from "../services/r2";
import type { Env } from "../types";

export const jobsRoute = new Hono<{ Bindings: Env }>().get(
  "/jobs/:jobId",
  async (c) => {
    const job = await getJob(c.env.DB, c.req.param("jobId"));
    if (!job) return c.json({ error: "job_not_found" }, 404);
    const response: Record<string, unknown> = {
      jobId: job.job_id,
      status: job.status,
      failureReason: job.failure_reason ?? undefined,
    };
    if (job.status === "completed" && job.r2_keys) {
      const keys = JSON.parse(job.r2_keys) as R2Files;
      const urls = await createSignedFileUrls(c.env, keys);
      response.files = {
        tokens: { url: urls.tokens },
        designMd: { url: urls.designMd },
        brandGuide: { url: urls.brandGuide },
      };
    }
    return c.json(response);
  },
);
