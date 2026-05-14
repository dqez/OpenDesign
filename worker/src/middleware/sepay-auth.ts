import { createMiddleware } from "hono/factory";
import { getSePayAllowedIps } from "../config";
import { isAllowedSePayIp, verifySePayAuthorization } from "../services/sepay";
import type { AppEnv } from "../types";

export const sepayAuthMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const clientIp =
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "";

  if (!isAllowedSePayIp(clientIp, getSePayAllowedIps(c.env))) {
    return c.json({ success: false, error: "forbidden_ip" }, 403);
  }

  if (
    !verifySePayAuthorization(
      c.req.header("Authorization") ?? null,
      c.env.SEPAY_API_KEY,
    )
  ) {
    return c.json({ success: false, error: "unauthorized" }, 401);
  }

  await next();
});
