import { Hono } from "hono";
import { apiCors } from "./middleware/cors";
import { extractRoute } from "./routes/extract";
import { healthRoute } from "./routes/health";
import { jobsRoute } from "./routes/jobs";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>().basePath("/api");
app.use("*", apiCors());
app.route("/", healthRoute);
app.route("/", extractRoute);
app.route("/", jobsRoute);

export default app;
