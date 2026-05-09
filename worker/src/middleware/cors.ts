import { cors } from "hono/cors";
import type { AppEnv } from "../types";

export function apiCors() {
  return cors({
    origin: (origin, c) => {
      const allowed = new Set([
        c.env.FRONTEND_ORIGIN,
        c.env.DEV_ORIGIN,
        ...splitOrigins(c.env.DEV_ORIGINS),
      ]);
      return origin && allowed.has(origin) ? origin : c.env.FRONTEND_ORIGIN;
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["content-type", "authorization"],
    maxAge: 86_400,
  });
}

function splitOrigins(value?: string) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
