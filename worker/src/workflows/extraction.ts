import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { writeAuditEvent } from "../services/audit";
import { runContainerExtraction } from "../services/container";
import { updateJobStatus } from "../services/db";
import { createSignedFileUrls } from "../services/r2";
import type { Env, ExtractionPayload } from "../types";

export async function runExtractionWorkflow(
  env: Env,
  payload: ExtractionPayload,
  step: WorkflowStep,
) {
  try {
    await step.do("mark-processing", async () => {
      await updateJobStatus(env.DB, payload.jobId, "processing");
    });

    await step.do("record-workflow-started", async () => {
      await writeAuditEvent(env.DB, {
        jobId: payload.jobId,
        actorType: "system",
        eventType: "workflow.started",
        metadata: { url: payload.url },
      });
    });

    const result = await step.do(
      "run-extraction",
      {
        retries: { limit: 2, delay: "1 minute", backoff: "exponential" },
        timeout: "6 minutes",
      },
      async () =>
        runContainerExtraction(env, {
          jobId: payload.jobId,
          url: payload.url,
        }),
    );

    const signedUrls = await step.do(
      "generate-signed-download-urls",
      async () => createSignedFileUrls(env, result.files),
    );

    await step.do("mark-completed", async () => {
      await updateJobStatus(env.DB, payload.jobId, "completed", {
        r2Keys: result.files,
      });
    });

    return { files: result.files, signedUrls };
  } catch (error) {
    const failureReason =
      error instanceof Error ? error.message : "unknown extraction error";
    await updateJobStatus(env.DB, payload.jobId, "failed", {
      failureReason,
    });
    await writeAuditEvent(env.DB, {
      jobId: payload.jobId,
      actorType: "system",
      eventType: "workflow.failed",
      metadata: { failureReason },
    });
    throw error;
  }
}

export class ExtractionWorkflow extends WorkflowEntrypoint<
  Env,
  ExtractionPayload
> {
  async run(event: WorkflowEvent<ExtractionPayload>, step: WorkflowStep) {
    return runExtractionWorkflow(this.env, event.payload, step);
  }
}
