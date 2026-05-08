import { expect, it, vi } from "vitest";
import app from "../src/app";
import { mockEnvWithIpCount } from "./route-mocks";

it("returns order status with job poll URL after payment creates a job", async () => {
  const env = mockEnvWithIpCount(1);
  const first = vi.fn().mockResolvedValue({
    order_code: "2D-A1B2C3",
    job_id: "job_paid",
    amount: 25000,
    currency: "VND",
    status: "paid",
    expires_at: "2026-05-09T00:00:00.000Z",
    paid_at: "2026-05-08T00:00:00.000Z",
  });
  const bind = vi.fn(() => ({ first }));
  env.DB.prepare = vi.fn(() => ({ bind })) as never;

  const response = await app.request("/api/orders/2D-A1B2C3", {}, env);

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    orderCode: "2D-A1B2C3",
    status: "paid",
    jobId: "job_paid",
    pollUrl: "/api/jobs/job_paid",
  });
});

it("returns 404 for missing order", async () => {
  const env = mockEnvWithIpCount(1);
  const first = vi.fn().mockResolvedValue(null);
  const bind = vi.fn(() => ({ first }));
  env.DB.prepare = vi.fn(() => ({ bind })) as never;

  const response = await app.request("/api/orders/2D-MISSING", {}, env);

  expect(response.status).toBe(404);
});
