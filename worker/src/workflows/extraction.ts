import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { writeAuditEvent } from "../services/audit";
import { runContainerExtraction } from "../services/container";
import { recordEmailLog, updateJobStatus } from "../services/db";
import { sendCompletionEmail } from "../services/email";
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

export class ExtractionWorkflow extends WorkflowEntrypoint<
  Env,
  ExtractionPayload
> {
  async run(event: WorkflowEvent<ExtractionPayload>, step: WorkflowStep) {
    return runExtractionWorkflow(this.env, event.payload, step);
  }
}
