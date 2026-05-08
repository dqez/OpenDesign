import { Hono } from "hono";
import { getOrderStatusByCode } from "../services/db";
import type { Env } from "../types";

export const ordersRoute = new Hono<{ Bindings: Env }>().get(
  "/orders/:orderCode",
  async (c) => {
    const order = await getOrderStatusByCode(c.env.DB, c.req.param("orderCode"));
    if (!order) return c.json({ error: "order_not_found" }, 404);

    return c.json({
      orderCode: order.order_code,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      expiresAt: order.expires_at,
      paidAt: order.paid_at,
      jobId: order.job_id,
      pollUrl: order.job_id ? `/api/jobs/${order.job_id}` : null,
    });
  },
);
