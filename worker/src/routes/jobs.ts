import { Hono } from "hono";
import { getJob } from "../services/db";
import type { Env } from "../types";

export const jobsRoute = new Hono<{ Bindings: Env }>().get(
  "/jobs/:jobId",
  async (c) => {
    const job = await getJob(c.env.DB, c.req.param("jobId"));
    if (!job) return c.json({ error: "job_not_found" }, 404);
    return c.json(job);
  },
);
