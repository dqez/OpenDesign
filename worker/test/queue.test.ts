import { expect, it, vi } from "vitest";
import { handleQueue } from "../src/queue";
import type { Env, ExtractionPayload } from "../src/types";

it("starts a workflow for each queue message and acknowledges it", async () => {
  const create = vi.fn().mockResolvedValue({ id: "workflow_1" });
  const message = {
    body: {
      jobId: "job_123",
      url: "https://neon.com/",
      email: "user@example.com",
    },
    ack: vi.fn(),
  };
  const batch = {
    messages: [message],
  } as unknown as MessageBatch<ExtractionPayload>;

  await handleQueue(batch, {
    EXTRACTION_WORKFLOW: { create },
  } as unknown as Env);

  expect(create).toHaveBeenCalledWith({ params: message.body });
  expect(message.ack).toHaveBeenCalled();
});
