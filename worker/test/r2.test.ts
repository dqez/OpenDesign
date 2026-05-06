import { describe, expect, it } from "vitest";
import { buildR2ObjectUrl } from "../src/services/r2";

describe("buildR2ObjectUrl", () => {
  it("builds an account-scoped R2 S3 URL", () => {
    expect(
      buildR2ObjectUrl({
        accountId: "abc123",
        bucketName: "2design-outputs",
        key: "neon.com/job_abc/tokens.json",
      }),
    ).toBe(
      "https://abc123.r2.cloudflarestorage.com/2design-outputs/neon.com/job_abc/tokens.json",
    );
  });
});
