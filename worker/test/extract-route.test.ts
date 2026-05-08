import { expect, it } from "vitest";
import app from "../src/app";
import { mockEnvWithIpCount } from "./route-mocks";

it("returns 202 and enqueues first free job", async () => {
  const env = mockEnvWithIpCount(0);
  const response = await app.request(
    "/api/extract",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "CF-Connecting-IP": "203.0.113.10",
      },
      body: JSON.stringify({
        url: "https://neon.com",
        email: "user@example.com",
      }),
    },
    env,
  );

  expect(response.status).toBe(202);
  await expect(response.json()).resolves.toMatchObject({ status: "queued" });
  expect(env.__mocks.queueSend).toHaveBeenCalledWith(
    expect.objectContaining({
      url: "https://neon.com/",
      email: "user@example.com",
    }),
  );
});

it("returns payment instructions for returning IP", async () => {
  const response = await app.request(
    "/api/extract",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "CF-Connecting-IP": "203.0.113.10",
      },
      body: JSON.stringify({
        url: "https://neon.com",
        email: "user@example.com",
      }),
    },
    mockEnvWithIpCount(1),
  );

  expect(response.status).toBe(402);
  await expect(response.json()).resolves.toMatchObject({
    requiresPayment: true,
    amount: 25000,
    orderStatusUrl: expect.stringMatching(/^\/api\/orders\/2D-/),
    bankInfo: {
      bank: "Vietcombank",
      content: expect.stringMatching(/^2D-/),
    },
  });
});

it("reuses an active pending order for returning IP", async () => {
  const env = mockEnvWithIpCount(1, {
    pendingOrder: {
      order_code: "2D-A1B2C3",
      job_id: null,
      url: "https://neon.com/",
      email: "user@example.com",
      ip_hash: "sha256:abc",
      amount: 25000,
      currency: "VND",
      status: "pending",
      created_at: "2026-05-08T00:00:00.000Z",
      paid_at: null,
      expires_at: "2026-05-09T00:00:00.000Z",
    },
  });

  const response = await app.request(
    "/api/extract",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "CF-Connecting-IP": "203.0.113.10",
      },
      body: JSON.stringify({
        url: "https://neon.com",
        email: "user@example.com",
      }),
    },
    env,
  );

  expect(response.status).toBe(402);
  await expect(response.json()).resolves.toMatchObject({
    requiresPayment: true,
    orderCode: "2D-A1B2C3",
    orderStatusUrl: "/api/orders/2D-A1B2C3",
  });
});
