import { Hono } from "hono";
import { healthRoute } from "./routes/health";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>().basePath("/api");
app.route("/", healthRoute);

export default app;
