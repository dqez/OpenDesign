import { beforeEach, expect, it, vi } from "vitest";
import { createExtraction, getJob } from "./api";

beforeEach(() => {
  vi.restoreAllMocks();
});

it("returns queued extraction responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status: 202,
      json: () =>
        Promise.resolve({
          jobId: "job_123",
          status: "queued",
          pollUrl: "/api/jobs/job_123",
        }),
    }),
  );

  await expect(
    createExtraction({ url: "https://neon.com", email: "user@example.com" }),
  ).resolves.toMatchObject({ jobId: "job_123" });
});

it("returns payment-required extraction responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status: 402,
      json: () =>
        Promise.resolve({
          requiresPayment: true,
          amount: 25000,
          orderCode: "2D-A1B2C3",
          bankInfo: {
            bank: "Vietcombank",
            accountNumber: "0123456789",
            accountName: "2Design",
            content: "2D-A1B2C3",
          },
          qrUrl: "https://qr.sepay.vn/img",
        }),
    }),
  );

  await expect(
    createExtraction({ url: "https://neon.com", email: "user@example.com" }),
  ).resolves.toMatchObject({ requiresPayment: true, amount: 25000 });
});

it("reads job status", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobId: "job_123", status: "processing" }),
    }),
  );

  await expect(getJob("job_123")).resolves.toEqual({
    jobId: "job_123",
    status: "processing",
  });
});
