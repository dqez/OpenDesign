import { Hono } from "hono";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { writeAuditEvent } from "../services/audit";
import { createJob, createOrder } from "../services/db";
import { createJobId, createOrderCode } from "../services/ids";
import { getClientIp, hashIp } from "../services/ip";
import { getIpUsage, incrementIpUsage } from "../services/kv";
import { buildSePayQrUrl } from "../services/sepay";
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
      const orderCode = createOrderCode();
      await createOrder(c.env.DB, {
        orderCode,
        url: body.url,
        email: body.email,
        ipHash,
        amount: 25000,
      });

      return c.json(
        {
          requiresPayment: true,
          message:
            "Ban da su dung luot mien phi. Chuyen khoan 25.000d de tiep tuc.",
          orderCode,
          amount: 25000,
          bankInfo: {
            bank: c.env.SEPAY_BANK_NAME,
            accountNumber: c.env.SEPAY_BANK_ACCOUNT,
            accountName: c.env.SEPAY_BANK_ACCOUNT_NAME,
            content: orderCode,
          },
          qrUrl: buildSePayQrUrl({
            bankName: c.env.SEPAY_BANK_NAME,
            accountNumber: c.env.SEPAY_BANK_ACCOUNT,
            amount: 25000,
            orderCode,
          }),
        },
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
