import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { writeAuditEvent } from "../services/audit";
import { updateJobStatus } from "../services/db";
import type { Env, ExtractionPayload } from "../types";

export class ExtractionWorkflow extends WorkflowEntrypoint<
  Env,
  ExtractionPayload
> {
  async run(event: WorkflowEvent<ExtractionPayload>, step: WorkflowStep) {
    const payload = event.payload;
    await step.do("mark-processing", async () => {
      await updateJobStatus(this.env.DB, payload.jobId, "processing");
    });

    await step.do("record-workflow-started", async () => {
      await writeAuditEvent(this.env.DB, {
        jobId: payload.jobId,
        actorType: "system",
        eventType: "workflow.started",
        metadata: { url: payload.url },
      });
    });
  }
}
