import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { writeAuditEvent } from "../services/audit";
import {
  getContainerExtractionStatus,
  startContainerExtraction,
  type ContainerExtractionStatus,
} from "../services/container";
import { recordEmailLog, updateJobStatus } from "../services/db";
import { sendCompletionEmail } from "../services/email";
import { createSignedFileUrls } from "../services/r2";
import type { Env, ExtractionPayload } from "../types";

const EXTRACTION_POLL_LIMIT = 80;
const EXTRACTION_POLL_INTERVAL = "15 seconds";

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

    const result = await waitForContainerExtraction(env, payload, step);

    const signedUrls = await step.do(
      "generate-signed-download-urls",
      async () => createSignedFileUrls(env, result.files),
    );

    await step.do("mark-completed", async () => {
      await updateJobStatus(env.DB, payload.jobId, "completed", {
        r2Keys: result.files,
      });
    });

    await step.do("send-email", async () => {
      const existing = await env.DB.prepare(
        "SELECT email_log_id FROM email_logs WHERE job_id = ? AND template = ? AND status = ?",
      )
        .bind(payload.jobId, "job-completed", "sent")
        .first();
      if (existing) return;

      const emailResult = await sendCompletionEmail({
        apiKey: env.RESEND_API_KEY,
        to: payload.email,
        downloadUrls: signedUrls,
      });
      await recordEmailLog(env.DB, {
        emailLogId: crypto.randomUUID(),
        jobId: payload.jobId,
        email: payload.email,
        template: "job-completed",
        providerMessageId: emailResult.data?.id ?? null,
        status: "sent",
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

async function waitForContainerExtraction(
  env: Env,
  payload: ExtractionPayload,
  step: WorkflowStep,
) {
  const startStatus = await step.do(
    "start-extraction",
    {
      retries: { limit: 2, delay: "5 seconds", backoff: "exponential" },
      timeout: "30 seconds",
    },
    async () =>
      startContainerExtraction(env, {
        jobId: payload.jobId,
        url: payload.url,
      }),
  );

  const completedFromStart = assertCompletedOrPending(startStatus);
  if (completedFromStart) return completedFromStart;

  for (let attempt = 1; attempt <= EXTRACTION_POLL_LIMIT; attempt += 1) {
    const status = await step.do(
      `poll-extraction-${attempt}`,
      {
        retries: { limit: 2, delay: "5 seconds", backoff: "exponential" },
        timeout: "30 seconds",
      },
      async () => getContainerExtractionStatus(env, payload.jobId),
    );

    const completed = assertCompletedOrPending(status);
    if (completed) return completed;

    if (attempt < EXTRACTION_POLL_LIMIT) {
      await step.sleep(
        `wait-for-extraction-${attempt}`,
        EXTRACTION_POLL_INTERVAL,
      );
    }
  }

  throw new Error(
    `extractor_timeout:${EXTRACTION_POLL_LIMIT} polls without completion`,
  );
}

function assertCompletedOrPending(status: ContainerExtractionStatus) {
  if (status.status === "failed") {
    throw new Error(`extractor_failed:${status.error}`);
  }

  if (status.status === "completed") {
    return status;
  }

  return null;
}

export class ExtractionWorkflow extends WorkflowEntrypoint<
  Env,
  ExtractionPayload
> {
  async run(event: WorkflowEvent<ExtractionPayload>, step: WorkflowStep) {
    return runExtractionWorkflow(this.env, event.payload, step);
  }
}
