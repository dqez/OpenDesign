import { Hono } from "hono";
import type { Env } from "../types";

export const healthRoute = new Hono<{ Bindings: Env }>().get(
  "/health",
  (c) => {
    return c.json({ ok: true, service: "2design-api" });
  },
);
