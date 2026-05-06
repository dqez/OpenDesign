import { beforeEach, expect, it, vi } from "vitest";
import type { WorkflowStep } from "cloudflare:workers";
import type { Env, ExtractionPayload } from "../src/types";

const mocks = vi.hoisted(() => ({
  runContainerExtraction: vi.fn(),
  createSignedFileUrls: vi.fn(),
  updateJobStatus: vi.fn(),
  writeAuditEvent: vi.fn(),
}));

vi.mock("../src/services/container", () => ({
  runContainerExtraction: mocks.runContainerExtraction,
}));

vi.mock("../src/services/r2", () => ({
  createSignedFileUrls: mocks.createSignedFileUrls,
}));

vi.mock("../src/services/db", () => ({
  updateJobStatus: mocks.updateJobStatus,
}));

vi.mock("../src/services/audit", () => ({
  writeAuditEvent: mocks.writeAuditEvent,
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
});

it("marks jobs completed after container extraction", async () => {
  await runExtractionWorkflow({ DB: {} } as Env, payload, stepMock());

  expect(mocks.updateJobStatus).toHaveBeenCalledWith(
    {},
    "job_123",
    "processing",
  );
  expect(mocks.runContainerExtraction).toHaveBeenCalledWith(
    { DB: {} },
    { jobId: "job_123", url: "https://neon.com/" },
  );
  expect(mocks.updateJobStatus).toHaveBeenCalledWith(
    {},
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
