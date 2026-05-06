import { beforeEach, expect, it, vi } from "vitest";
import type { WorkflowStep } from "cloudflare:workers";
import type { Env, ExtractionPayload } from "../src/types";

const mocks = vi.hoisted(() => ({
  runContainerExtraction: vi.fn(),
  createSignedFileUrls: vi.fn(),
  updateJobStatus: vi.fn(),
  recordEmailLog: vi.fn(),
  writeAuditEvent: vi.fn(),
  sendCompletionEmail: vi.fn(),
}));

vi.mock("../src/services/container", () => ({
  runContainerExtraction: mocks.runContainerExtraction,
}));

vi.mock("../src/services/r2", () => ({
  createSignedFileUrls: mocks.createSignedFileUrls,
}));

vi.mock("../src/services/db", () => ({
  updateJobStatus: mocks.updateJobStatus,
  recordEmailLog: mocks.recordEmailLog,
}));

vi.mock("../src/services/audit", () => ({
  writeAuditEvent: mocks.writeAuditEvent,
}));

vi.mock("../src/services/email", () => ({
  sendCompletionEmail: mocks.sendCompletionEmail,
}));

const { runExtractionWorkflow } = await import("../src/workflows/extraction");

function stepMock() {
  return {
    do: vi.fn(
      async (
        _name: string,
        configOrCallback: unknown,
        maybeCallback?: () => Promise<unknown>,
      ) => {
        const callback =
          typeof configOrCallback === "function"
            ? configOrCallback
            : maybeCallback;
        return callback?.();
      },
    ),
  } as unknown as WorkflowStep;
}

const payload: ExtractionPayload = {
  jobId: "job_123",
  url: "https://neon.com/",
  email: "user@example.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.runContainerExtraction.mockResolvedValue({
    ok: true,
    domain: "neon.com",
    files: {
      tokens: "neon.com/job_123/tokens.json",
      designMd: "neon.com/job_123/DESIGN.md",
      brandGuide: "neon.com/job_123/brand-guide.pdf",
    },
  });
  mocks.createSignedFileUrls.mockResolvedValue({
    tokens: "https://signed/tokens",
    designMd: "https://signed/design",
    brandGuide: "https://signed/pdf",
  });
  mocks.sendCompletionEmail.mockResolvedValue({
    data: { id: "email_123" },
    error: null,
  });
  mocks.recordEmailLog.mockResolvedValue({ success: true });
});

it("marks jobs completed after container extraction", async () => {
  const db = {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn().mockResolvedValue(null),
      })),
    })),
  };
  await runExtractionWorkflow(
    { DB: db, RESEND_API_KEY: "resend-secret" } as unknown as Env,
    payload,
    stepMock(),
  );

  expect(mocks.updateJobStatus).toHaveBeenCalledWith(
    db,
    "job_123",
    "processing",
  );
  expect(mocks.runContainerExtraction).toHaveBeenCalledWith(
    { DB: db, RESEND_API_KEY: "resend-secret" },
    { jobId: "job_123", url: "https://neon.com/" },
  );
  expect(mocks.updateJobStatus).toHaveBeenCalledWith(
    db,
    "job_123",
    "completed",
    {
      r2Keys: {
        tokens: "neon.com/job_123/tokens.json",
        designMd: "neon.com/job_123/DESIGN.md",
        brandGuide: "neon.com/job_123/brand-guide.pdf",
      },
    },
  );
  expect(mocks.sendCompletionEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      apiKey: "resend-secret",
      to: "user@example.com",
    }),
  );
  expect(mocks.recordEmailLog).toHaveBeenCalledWith(
    db,
    expect.objectContaining({
      jobId: "job_123",
      providerMessageId: "email_123",
      status: "sent",
    }),
  );
});

it("marks jobs failed when extraction throws", async () => {
  mocks.runContainerExtraction.mockRejectedValue(new Error("container boom"));

  await expect(
    runExtractionWorkflow({ DB: {} } as Env, payload, stepMock()),
  ).rejects.toThrow("container boom");

  expect(mocks.updateJobStatus).toHaveBeenCalledWith(
    {},
    "job_123",
    "failed",
    { failureReason: "container boom" },
  );
});
