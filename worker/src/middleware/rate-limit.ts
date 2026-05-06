import { createMiddleware } from "hono/factory";
import { getClientIp, hashIp } from "../services/ip";
import type { AppEnv } from "../types";

export async function checkRateLimit(
  kv: KVNamespace,
  ipHash: string,
  nowMs = Date.now(),
) {
  const minuteBucket = Math.floor(nowMs / 60_000);
  const key = `rate:${ipHash}:${minuteBucket}`;
  const current = Number((await kv.get(key)) ?? "0");
  if (current >= 5) return { allowed: false, current };
  await kv.put(key, String(current + 1), { expirationTtl: 120 });
  return { allowed: true, current: current + 1 };
}

export async function checkPendingJobLimit(db: D1Database) {
  const result = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM jobs WHERE status IN ('queued', 'processing')",
    )
    .bind()
    .first<{ count: number }>();
  const current = result?.count ?? 0;
  return { allowed: current < 100, current };
}

export const rateLimitMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const ipHash = await hashIp(getClientIp(c.req.raw), c.env.IP_HASH_SALT);
  const rate = await checkRateLimit(c.env.KV, ipHash);
  if (!rate.allowed) {
    return c.json({ error: "rate_limit_exceeded", limit: 5 }, 429);
  }

  const pending = await checkPendingJobLimit(c.env.DB);
  if (!pending.allowed) {
    return c.json({ error: "system_busy", maxPendingJobs: 100 }, 503);
  }

  await next();
});
