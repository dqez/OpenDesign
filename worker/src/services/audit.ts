import { createEventId } from "./ids";

export async function writeAuditEvent(
  db: D1Database,
  event: {
    jobId?: string;
    actorType: "user" | "system" | "provider";
    eventType: string;
    metadata: unknown;
  },
) {
  return db
    .prepare(
      "INSERT INTO audit_events (event_id, job_id, actor_type, event_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      createEventId(),
      event.jobId ?? null,
      event.actorType,
      event.eventType,
      JSON.stringify(event.metadata),
      new Date().toISOString(),
    )
    .run();
}
