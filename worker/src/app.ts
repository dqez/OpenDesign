import { Hono } from "hono";
import { apiCors } from "./middleware/cors";
import { healthRoute } from "./routes/health";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>().basePath("/api");
app.use("*", apiCors());
app.route("/", healthRoute);

export default app;
