import { ContainerProxy } from "@cloudflare/containers";
import app from "./app";
import { DembrandtContainer } from "./containers/dembrandt";
import { handleQueue } from "./queue";
import { ExtractionWorkflow } from "./workflows/extraction";
import type { Env, ExtractionPayload } from "./types";

export { ContainerProxy, DembrandtContainer, ExtractionWorkflow };

export default {
  fetch: app.fetch,
  queue: (batch: MessageBatch<ExtractionPayload>, env: Env) =>
    handleQueue(batch, env),
};
