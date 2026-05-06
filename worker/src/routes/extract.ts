import { Hono } from "hono";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { writeAuditEvent } from "../services/audit";
import { createJob } from "../services/db";
import { createJobId } from "../services/ids";
import { getClientIp, hashIp } from "../services/ip";
import { getIpUsage, incrementIpUsage } from "../services/kv";
import { extractRequestSchema } from "../services/validation";
import type { Env } from "../types";

export const extractRoute = new Hono<{ Bindings: Env }>().post(
  "/extract",
  rateLimitMiddleware,
  async (c) => {
    const body = extractRequestSchema.parse(await c.req.json());
    const ipHash = await hashIp(getClientIp(c.req.raw), c.env.IP_HASH_SALT);
    const usage = await getIpUsage(c.env.KV, ipHash);

    if ((usage?.count ?? 0) >= 1) {
      return c.json(
        { requiresPayment: true, message: "Payment required" },
        402,
      );
    }

    const jobId = createJobId();
    const domain = new URL(body.url).hostname;
    await createJob(c.env.DB, {
      jobId,
      url: body.url,
      domain,
      email: body.email,
      ipHash,
      paid: false,
      orderCode: null,
    });
    await incrementIpUsage(c.env.KV, ipHash);
    await writeAuditEvent(c.env.DB, {
      jobId,
      actorType: "user",
      eventType: "job.queued",
      metadata: { domain },
    });
    await c.env.EXTRACT_QUEUE.send({
      jobId,
      url: body.url,
      email: body.email,
    });

    return c.json(
      { jobId, status: "queued", pollUrl: `/api/jobs/${jobId}` },
      202,
    );
  },
);
