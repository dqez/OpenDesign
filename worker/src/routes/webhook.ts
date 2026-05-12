import { Hono } from "hono";
import { getLegacyOrderCodePrefixes, getOrderCodePrefix } from "../config";
import { sepayAuthMiddleware } from "../middleware/sepay-auth";
import {
  createJob,
  getOrderByCode,
  getPaymentByProviderTransactionId,
  getWebhookEventByProviderEventId,
  markOrderPaidWithJob,
  markWebhookEventProcessed,
  recordPayment,
  recordWebhookEvent,
} from "../services/db";
import { createEventId, createJobId } from "../services/ids";
import {
  classifySePayAmount,
  extractOrderCodeFromWebhook,
  isExpectedSePayAccount,
  type SePayWebhookPayload,
} from "../services/sepay";
import type { Env } from "../types";

type OrderRecord = {
  order_code: string;
  job_id?: string | null;
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
    if (existing && (existing as { status?: string }).status === "processed") {
      return c.json({ success: true, duplicate: true });
    }

    const orderCode = extractOrderCodeFromWebhook(payload, [
      getOrderCodePrefix(c.env),
      ...getLegacyOrderCodePrefixes(c.env),
    ]);
    if (!existing) {
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
    }

    if (!isExpectedSePayAccount(payload.accountNumber, c.env.SEPAY_BANK_ACCOUNT)) {
      await markWebhookEventProcessed(c.env.DB, providerEventId, "ignored");
      return c.json({ success: true });
    }

    if (!orderCode || payload.transferType !== "in") {
      await markWebhookEventProcessed(c.env.DB, providerEventId, "ignored");
      return c.json({ success: true });
    }

    const order = (await getOrderByCode(c.env.DB, orderCode)) as
      | OrderRecord
      | null;
    if (!order || order.status !== "pending") {
      await markWebhookEventProcessed(c.env.DB, providerEventId, "ignored");
      return c.json({ success: true });
    }

    const transferAmount = Number(payload.transferAmount);
    if (!Number.isFinite(transferAmount)) {
      await markWebhookEventProcessed(c.env.DB, providerEventId, "ignored");
      return c.json({ success: true });
    }

    const amountStatus = classifySePayAmount(
      transferAmount,
      Number(order.amount),
    );
    if (amountStatus === "underpaid") {
      await markWebhookEventProcessed(c.env.DB, providerEventId, "ignored");
      return c.json({ success: true });
    }

    const existingPayment = await getPaymentByProviderTransactionId(
      c.env.DB,
      providerEventId,
    );
    if (!existingPayment) {
      await recordPayment(c.env.DB, {
        paymentId: `pay_${payload.id}`,
        orderCode,
        providerTransactionId: providerEventId,
        referenceCode: payload.referenceCode ?? null,
        amount: transferAmount,
        rawPayload: payload,
      });
    }

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
    await markOrderPaidWithJob(c.env.DB, { orderCode, jobId });
    await markWebhookEventProcessed(c.env.DB, providerEventId, "processed");
    await c.env.EXTRACT_QUEUE.send({
      jobId,
      url: order.url,
      email: order.email,
    });
    return c.json({ success: true });
  },
);
