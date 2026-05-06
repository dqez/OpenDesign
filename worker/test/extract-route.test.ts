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
    bankInfo: {
      bank: "Vietcombank",
      content: expect.stringMatching(/^2D-/),
    },
  });
});
