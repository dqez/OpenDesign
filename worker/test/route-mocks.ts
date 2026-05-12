import { vi } from "vitest";

export function mockEnvWithIpCount(
  count: number,
  options: { pendingOrder?: unknown } = {},
) {
  const queueSend = vi.fn().mockResolvedValue(undefined);
  const kvGet = vi.fn((key: string, type?: string) => {
    if (key.startsWith("rate:")) return Promise.resolve("0");
    if (type === "json") {
      return Promise.resolve(
        count > 0
          ? {
              count,
              firstSeen: "2026-05-06T00:00:00.000Z",
              lastSeen: "2026-05-06T00:00:00.000Z",
            }
          : null,
      );
    }
    return Promise.resolve(null);
  });
  const run = vi.fn().mockResolvedValue({ success: true });
  const first = vi.fn((sql?: string) => {
    if (sql?.includes("orders WHERE ip_hash")) {
      return Promise.resolve(options.pendingOrder ?? null);
    }
    return Promise.resolve({ count: 0 });
  });
  const bind = vi.fn(() => ({ run, first }));
  const prepare = vi.fn((sql: string) => ({
    bind: vi.fn(() => ({ run, first: () => first(sql) })),
  }));

  return {
    DB: { prepare },
    KV: {
      get: kvGet,
      put: vi.fn().mockResolvedValue(undefined),
    },
    EXTRACT_QUEUE: { send: queueSend },
    IP_HASH_SALT: "salt",
    FRONTEND_ORIGIN: "https://opendesign.pages.dev",
    DEV_ORIGIN: "http://localhost:5173",
    SEPAY_BANK_ACCOUNT: "0123456789",
    SEPAY_BANK_NAME: "Vietcombank",
    SEPAY_BANK_ACCOUNT_NAME: "OpenDesign",
    __mocks: { queueSend, prepare, bind, run },
  };
}

export function mockEnvWithNoJob() {
  const first = vi.fn().mockResolvedValue(null);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  return {
    DB: { prepare },
    FRONTEND_ORIGIN: "https://opendesign.pages.dev",
    DEV_ORIGIN: "http://localhost:5173",
    __mocks: { prepare, bind, first },
  };
}
