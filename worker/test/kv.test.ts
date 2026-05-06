import { expect, it, vi } from "vitest";
import { getIpUsage, incrementIpUsage } from "../src/services/kv";

function mockKv(initial: unknown = null) {
  return {
    get: vi.fn().mockResolvedValue(initial),
    put: vi.fn().mockResolvedValue(undefined),
  } as unknown as KVNamespace;
}

it("reads IP usage from KV", async () => {
  const usage = {
    count: 1,
    firstSeen: "2026-05-06T00:00:00.000Z",
    lastSeen: "2026-05-06T00:00:00.000Z",
  };
  await expect(getIpUsage(mockKv(usage), "sha256:abc")).resolves.toEqual(usage);
});

it("increments IP usage with a 90 day TTL", async () => {
  const kv = mockKv({
    count: 1,
    firstSeen: "2026-05-06T00:00:00.000Z",
    lastSeen: "2026-05-06T00:00:00.000Z",
  });
  const next = await incrementIpUsage(kv, "sha256:abc");
  expect(next.count).toBe(2);
  expect(kv.put).toHaveBeenCalledWith(
    "ip:sha256:abc",
    expect.any(String),
    { expirationTtl: 60 * 60 * 24 * 90 },
  );
});
