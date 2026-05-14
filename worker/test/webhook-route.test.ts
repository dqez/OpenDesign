import { expect, it, vi } from "vitest";
import app from "../src/app";

function mockWebhookEnv(options: {
  existingWebhook?: unknown;
  order?: unknown;
} = {}) {
  const queueSend = vi.fn().mockResolvedValue(undefined);
  const run = vi.fn().mockResolvedValue({ success: true });
  const prepare = vi.fn((sql: string) => ({
    bind: vi.fn(() => ({
      run,
      first: vi.fn(async () => {
        if (sql.includes("webhook_events WHERE")) {
          return options.existingWebhook ?? null;
        }
        if (sql.includes("orders WHERE")) {
          return (
            options.order ?? {
              order_code: "OD-A1B2C3",
              url: "https://neon.com/",
              email: "user@example.com",
              ip_hash: "sha256:abc",
              amount: 25000,
              status: "pending",
            }
          );
        }
        if (sql.includes("payments WHERE")) {
          return null;
        }
        return null;
      }),
    })),
  }));

  return {
    DB: { prepare },
    EXTRACT_QUEUE: { send: queueSend },
    SEPAY_API_KEY: "secret",
    SEPAY_BANK_ACCOUNT: "0123456789",
    SEPAY_BANK_NAME: "Vietcombank",
    SEPAY_BANK_ACCOUNT_NAME: "OpenDesign",
    FRONTEND_ORIGIN: "https://opendesign.pages.dev",
    DEV_ORIGIN: "http://localhost:5173",
    __mocks: { queueSend, run, prepare },
  };
}

const validPayload = {
  id: 42,
  gateway: "Vietcombank",
  transactionDate: "2026-05-08 14:00:00",
  accountNumber: "0123456789",
  code: "OD-A1B2C3",
  content: "OD-A1B2C3",
  transferType: "in",
  transferAmount: 25000,
  referenceCode: "REF42",
};

it("rejects non-whitelisted SePay IPs", async () => {
  const response = await app.request(
    "/api/sepay/webhook",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: "Apikey secret",
        "CF-Connecting-IP": "203.0.113.10",
      },
      body: JSON.stringify(validPayload),
    },
    mockWebhookEnv(),
  );

  expect(response.status).toBe(403);
});

it("rejects invalid SePay authorization", async () => {
  const response = await app.request(
    "/api/sepay/webhook",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: "Bearer secret",
        "CF-Connecting-IP": "172.236.138.20",
      },
      body: JSON.stringify(validPayload),
    },
    mockWebhookEnv(),
  );

  expect(response.status).toBe(401);
});

it("records valid webhooks and enqueues a paid job", async () => {
  const env = mockWebhookEnv();
  const response = await app.request(
    "/api/sepay/webhook",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: "Apikey secret",
        "CF-Connecting-IP": "172.236.138.20",
      },
      body: JSON.stringify(validPayload),
    },
    env,
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ success: true });
  expect(env.__mocks.queueSend).toHaveBeenCalledWith(
    expect.objectContaining({
      url: "https://neon.com/",
      email: "user@example.com",
    }),
  );
});

it("records legacy 2D webhooks for existing pending orders", async () => {
  const env = mockWebhookEnv({
    order: {
      order_code: "2D-A1B2C3",
      url: "https://neon.com/",
      email: "user@example.com",
      ip_hash: "sha256:abc",
      amount: 25000,
      status: "pending",
    },
  });
  const response = await app.request(
    "/api/sepay/webhook",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: "Apikey secret",
        "CF-Connecting-IP": "172.236.138.20",
      },
      body: JSON.stringify({
        ...validPayload,
        code: "2D-A1B2C3",
        content: "2D-A1B2C3",
      }),
    },
    env,
  );

  expect(response.status).toBe(200);
  expect(env.__mocks.queueSend).toHaveBeenCalledOnce();
});

it("accepts overpayment and enqueues a paid job", async () => {
  const env = mockWebhookEnv();
  const response = await app.request(
    "/api/sepay/webhook",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: "Apikey secret",
        "CF-Connecting-IP": "172.236.138.20",
      },
      body: JSON.stringify({
        ...validPayload,
        id: 43,
        transferAmount: 30000,
      }),
    },
    env,
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ success: true });
  expect(env.__mocks.queueSend).toHaveBeenCalledOnce();
});

it("ignores underpayment without enqueueing a job", async () => {
  const env = mockWebhookEnv();
  const response = await app.request(
    "/api/sepay/webhook",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: "Apikey secret",
        "CF-Connecting-IP": "172.236.138.20",
      },
      body: JSON.stringify({
        ...validPayload,
        id: 44,
        transferAmount: 20000,
      }),
    },
    env,
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ success: true });
  expect(env.__mocks.queueSend).not.toHaveBeenCalled();
});

it("resumes existing received webhook events instead of returning duplicate early", async () => {
  const env = mockWebhookEnv({
    existingWebhook: {
      webhook_event_id: "wh_42",
      status: "received",
      order_code: "OD-A1B2C3",
    },
  });

  const response = await app.request(
    "/api/sepay/webhook",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: "Apikey secret",
        "CF-Connecting-IP": "172.236.138.20",
      },
      body: JSON.stringify(validPayload),
    },
    env,
  );

  expect(response.status).toBe(200);
  expect(env.__mocks.queueSend).toHaveBeenCalledOnce();
});

it("rejects webhook for a different receiving account", async () => {
  const env = mockWebhookEnv();
  const response = await app.request(
    "/api/sepay/webhook",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: "Apikey secret",
        "CF-Connecting-IP": "172.236.138.20",
      },
      body: JSON.stringify({
        ...validPayload,
        id: 45,
        accountNumber: "0000000000",
      }),
    },
    env,
  );

  expect(response.status).toBe(200);
  expect(env.__mocks.queueSend).not.toHaveBeenCalled();
});

it("deduplicates repeated webhook events", async () => {
  const env = mockWebhookEnv({
    existingWebhook: { webhook_event_id: "wh_42", status: "processed" },
  });
  const response = await app.request(
    "/api/sepay/webhook",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: "Apikey secret",
        "CF-Connecting-IP": "172.236.138.20",
      },
      body: JSON.stringify(validPayload),
    },
    env,
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    success: true,
    duplicate: true,
  });
  expect(env.__mocks.queueSend).not.toHaveBeenCalled();
});
