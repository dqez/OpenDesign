import { Hono } from "hono";
import { sepayAuthMiddleware } from "../middleware/sepay-auth";
import {
  createJob,
  getOrderByCode,
  getWebhookEventByProviderEventId,
  markOrderPaid,
  markWebhookEventProcessed,
  recordPayment,
  recordWebhookEvent,
} from "../services/db";
import { createEventId, createJobId } from "../services/ids";
import {
  extractOrderCodeFromWebhook,
  type SePayWebhookPayload,
} from "../services/sepay";
import type { Env } from "../types";

type OrderRecord = {
  order_code: string;
  url: string;
  email: string;
  ip_hash: string;
  amount: number;
  status: string;
};

export const webhookRoute = new Hono<{ Bindings: Env }>().post(
  "/sepay/webhook",
  sepayAuthMiddleware,
  async (c) => {
    const payload = await c.req.json<SePayWebhookPayload>();
    const providerEventId = String(payload.id);
    const existing = await getWebhookEventByProviderEventId(
      c.env.DB,
      providerEventId,
    );
    if (existing) return c.json({ success: true, duplicate: true });

    const orderCode = extractOrderCodeFromWebhook(payload);
    try {
      await recordWebhookEvent(c.env.DB, {
        webhookEventId: createEventId().replace("evt_", "wh_"),
        providerEventId,
        orderCode,
        status: orderCode ? "received" : "ignored",
        rawPayload: payload,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        return c.json({ success: true, duplicate: true });
      }
      throw error;
    }

    if (!orderCode || payload.transferType !== "in") {
      await markWebhookEventProcessed(c.env.DB, providerEventId, "ignored");
      return c.json({ success: true });
    }

    const order = (await getOrderByCode(c.env.DB, orderCode)) as
      | OrderRecord
      | null;
    if (
      !order ||
      order.status !== "pending" ||
      Number(order.amount) !== Number(payload.transferAmount)
    ) {
      await markWebhookEventProcessed(c.env.DB, providerEventId, "ignored");
      return c.json({ success: true });
    }

    await recordPayment(c.env.DB, {
      paymentId: `pay_${payload.id}`,
      orderCode,
      providerTransactionId: providerEventId,
      referenceCode: payload.referenceCode ?? null,
      amount: Number(payload.transferAmount),
      rawPayload: payload,
    });
    await markOrderPaid(c.env.DB, orderCode);
    await markWebhookEventProcessed(c.env.DB, providerEventId, "processed");

    const jobId = createJobId();
    await createJob(c.env.DB, {
      jobId,
      url: order.url,
      domain: new URL(order.url).hostname,
      email: order.email,
      ipHash: order.ip_hash,
      paid: true,
      orderCode,
    });
    await c.env.EXTRACT_QUEUE.send({
      jobId,
      url: order.url,
      email: order.email,
    });
    return c.json({ success: true });
  },
);
