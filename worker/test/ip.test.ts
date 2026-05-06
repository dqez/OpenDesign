import { describe, expect, it } from "vitest";
import { getClientIp, hashIp } from "../src/services/ip";

describe("getClientIp", () => {
  it("uses CF-Connecting-IP first", () => {
    const request = new Request("https://api.test", {
      headers: {
        "CF-Connecting-IP": "203.0.113.10",
        "X-Forwarded-For": "198.51.100.1",
      },
    });
    expect(getClientIp(request)).toBe("203.0.113.10");
  });

  it("falls back to the first forwarded IP", () => {
    const request = new Request("https://api.test", {
      headers: { "X-Forwarded-For": "198.51.100.1, 198.51.100.2" },
    });
    expect(getClientIp(request)).toBe("198.51.100.1");
  });
});

describe("hashIp", () => {
  it("hashes IP addresses with a salt", async () => {
    const hash = await hashIp("203.0.113.10", "salt");
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    await expect(hashIp("203.0.113.10", "other")).resolves.not.toBe(hash);
  });
});
