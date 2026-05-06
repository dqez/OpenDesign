import { expect, it, vi } from "vitest";
import { createJob, getJob, updateJobStatus } from "../src/services/db";

function mockDb() {
  const run = vi.fn().mockResolvedValue({ success: true });
  const first = vi
    .fn()
    .mockResolvedValue({ job_id: "job_123", status: "queued" });
  const bind = vi.fn(() => ({ run, first }));
  const prepare = vi.fn(() => ({ bind }));
  return {
    db: { prepare } as unknown as D1Database,
    run,
    first,
    bind,
    prepare,
  };
}

it("creates a queued job", async () => {
  const { db, prepare, bind, run } = mockDb();
  await createJob(db, {
    jobId: "job_123",
    url: "https://neon.com/",
    domain: "neon.com",
    email: "user@example.com",
    ipHash: "sha256:abc",
    paid: false,
    orderCode: null,
  });
  expect(prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO jobs"));
  expect(bind).toHaveBeenCalledWith(
    "job_123",
    "https://neon.com/",
    "neon.com",
    "user@example.com",
    "sha256:abc",
    "queued",
    0,
    null,
    expect.any(String),
  );
  expect(run).toHaveBeenCalled();
});

it("reads a job by id", async () => {
  const { db } = mockDb();
  await expect(getJob(db, "job_123")).resolves.toMatchObject({
    job_id: "job_123",
  });
});

it("updates job status", async () => {
  const { db, prepare } = mockDb();
  await updateJobStatus(db, "job_123", "processing");
  expect(prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE jobs"));
});
