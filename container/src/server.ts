import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { buildOutputKeys, runDembrandt } from "./execute.js";
import { healthPayload } from "./health.js";
import { uploadObject } from "./r2.js";

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
  const result = await runDembrandt(url, jobId);
  const keys = buildOutputKeys(result.domain, jobId);

  await uploadObject(keys.tokens, result.files.tokens, "application/json");
  await uploadObject(
    keys.designMd,
    result.files.designMd,
    "text/markdown; charset=utf-8",
  );
  await uploadObject(keys.brandGuide, result.files.brandGuide, "application/pdf");

  return c.json({ ok: true, domain: result.domain, files: keys });
});

if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8080) });
}
