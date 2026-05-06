import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { healthPayload } from "./health.js";

const app = new Hono();

app.get("/health", (c) => c.json(healthPayload()));

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8080) });
