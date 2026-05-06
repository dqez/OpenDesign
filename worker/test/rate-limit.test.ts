import { describe, expect, it, vi } from "vitest";
import {
  checkPendingJobLimit,
  checkRateLimit,
} from "../src/middleware/rate-limit";

function mockKv(initialValue: string | null) {
  return {
    get: vi.fn().mockResolvedValue(initialValue),
    put: vi.fn().mockResolvedValue(undefined),
  } as unknown as KVNamespace;
}

function mockDb(count: number) {
  const first = vi.fn().mockResolvedValue({ count });
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  return { prepare } as unknown as D1Database;
}

describe("checkRateLimit", () => {
  it("allows the first 5 requests in a minute bucket", async () => {
    await expect(
      checkRateLimit(mockKv("4"), "sha256:abc", 1700000000000),
    ).resolves.toEqual({
      allowed: true,
      current: 5,
    });
  });

  it("rejects the 6th request in a minute bucket", async () => {
    await expect(
      checkRateLimit(mockKv("5"), "sha256:abc", 1700000000000),
    ).resolves.toEqual({
      allowed: false,
      current: 5,
    });
  });
});

describe("checkPendingJobLimit", () => {
  it("rejects when 100 jobs are queued or processing", async () => {
    await expect(checkPendingJobLimit(mockDb(100))).resolves.toEqual({
      allowed: false,
      current: 100,
    });
  });
});
