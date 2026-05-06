import { describe, expect, it } from "vitest";
import { extractRequestSchema } from "../src/services/validation";

describe("extractRequestSchema", () => {
  it("accepts valid url and email", () => {
    const parsed = extractRequestSchema.parse({
      url: "https://neon.com",
      email: "user@example.com",
    });
    expect(parsed.url).toBe("https://neon.com/");
  });

  it("rejects non-http URLs", () => {
    expect(() =>
      extractRequestSchema.parse({
        url: "file:///etc/passwd",
        email: "user@example.com",
      }),
    ).toThrow();
  });
});
