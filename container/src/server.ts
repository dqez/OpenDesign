import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { healthPayload } from "./health.js";
import {
  getExtractionJob,
  serializeExtractionJob,
  startExtractionJob,
} from "./jobs.js";

export const app = new Hono();

function isAuthorized(header: string | undefined | null) {
  const expected = process.env.EXTRACTOR_API_KEY;
  if (!expected) return false;
  return header === `Bearer ${expected}`;
}

app.get("/health", (c) => c.json(healthPayload()));

app.post("/extract", async (c) => {
  if (!isAuthorized(c.req.header("authorization"))) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const { jobId, url } = await c.req.json<{ jobId: string; url: string }>();
  const job = startExtractionJob(jobId, url);
  const statusCode = job.status === "processing" ? 202 : 200;
  return c.json(serializeExtractionJob(job), statusCode);
});

app.get("/extract/jobs/:jobId", (c) => {
  if (!isAuthorized(c.req.header("authorization"))) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const job = getExtractionJob(c.req.param("jobId"));
  if (!job) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json(serializeExtractionJob(job));
});

if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8080) });
}
