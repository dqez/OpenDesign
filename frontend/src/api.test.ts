import { beforeEach, expect, it, vi } from "vitest";
import { createExtraction, getDesignCatalog, getJob, getOrderStatus } from "./api";

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
          orderStatusUrl: "/api/orders/2D-A1B2C3",
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

it("fetches order status", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        orderCode: "2D-A1B2C3",
        status: "paid",
        amount: 25000,
        currency: "VND",
        expiresAt: "2026-05-09T00:00:00.000Z",
        paidAt: "2026-05-08T00:00:00.000Z",
        jobId: "job_paid",
        pollUrl: "/api/jobs/job_paid",
      }),
    }),
  );

  await expect(getOrderStatus("2D-A1B2C3")).resolves.toMatchObject({
    status: "paid",
    jobId: "job_paid",
  });
});

it("fetches extracted design catalog items", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [
        {
          slug: "supabase",
          brand: "Supabase",
          sourceUrl: "https://supabase.com",
          designMdUrl: "https://r2.example/supabase/DESIGN.md",
          tokensUrl: "https://r2.example/supabase/tokens.json",
          brandGuideUrl: "https://r2.example/supabase/brand-guide.pdf",
        },
      ],
    }),
  );

  await expect(getDesignCatalog()).resolves.toEqual([
    expect.objectContaining({
      slug: "supabase",
      brand: "Supabase",
      tokensUrl: "https://r2.example/supabase/tokens.json",
    }),
  ]);
});

it("reports unavailable design catalog when the response is not json", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/html" }),
      json: async () => {
        throw new SyntaxError("Unexpected token '<'");
      },
    }),
  );

  await expect(getDesignCatalog()).rejects.toThrow("designs_unavailable");
});
