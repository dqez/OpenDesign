import { ContainerProxy } from "@cloudflare/containers";
import app from "./app";
import { DembrandtContainer } from "./containers/dembrandt";
import { handleQueue } from "./queue";
import { expirePendingOrders } from "./services/db";
import { ExtractionWorkflow } from "./workflows/extraction";
import type { Env, ExtractionPayload } from "./types";

export { ContainerProxy, DembrandtContainer, ExtractionWorkflow };

export default {
  fetch: app.fetch,
  queue: (batch: MessageBatch<ExtractionPayload>, env: Env) =>
    handleQueue(batch, env),
  scheduled: async (_event: ScheduledEvent, env: Env) => {
    await expirePendingOrders(env.DB);
  },
};
