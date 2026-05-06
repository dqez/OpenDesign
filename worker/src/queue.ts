import type { Env, ExtractionPayload } from "./types";

export async function handleQueue(
  batch: MessageBatch<ExtractionPayload>,
  env: Env,
) {
  for (const message of batch.messages) {
    await env.EXTRACTION_WORKFLOW.create({ params: message.body });
    message.ack();
  }
}
