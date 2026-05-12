import { Hono } from "hono";
import { getServiceName } from "../config";
import type { Env } from "../types";

export const healthRoute = new Hono<{ Bindings: Env }>().get(
  "/health",
  (c) => {
    return c.json({ ok: true, service: getServiceName(c.env) });
  },
);
