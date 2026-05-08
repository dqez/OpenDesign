import { beforeEach, describe, expect, it, vi } from "vitest";

const runDembrandtMock = vi.fn();
const uploadObjectMock = vi.fn();

vi.mock("../src/execute.js", () => ({
  buildOutputKeys: () => ({
    tokens: "neon.com/job_123/tokens.json",
    designMd: "neon.com/job_123/DESIGN.md",
    brandGuide: "neon.com/job_123/brand-guide.pdf",
  }),
  runDembrandt: runDembrandtMock,
}));

vi.mock("../src/r2.js", () => ({
  uploadObject: uploadObjectMock,
}));

describe("extractor auth", () => {
  beforeEach(() => {
    process.env.EXTRACTOR_API_KEY = "shared-secret";
    runDembrandtMock.mockReset();
    uploadObjectMock.mockReset();
  });

  it("rejects extract requests without bearer token", async () => {
    const { app } = await import("../src/server.js");

    const response = await app.request("/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "job_123", url: "https://neon.com" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("accepts extract requests with the correct bearer token", async () => {
    runDembrandtMock.mockResolvedValue({
      domain: "neon.com",
      files: {
        tokens: new Uint8Array([123, 125]),
        designMd: new Uint8Array([35]),
        brandGuide: new Uint8Array([37]),
      },
    });
    uploadObjectMock.mockResolvedValue(undefined);
    const { app } = await import("../src/server.js");

    const response = await app.request("/extract", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer shared-secret",
      },
      body: JSON.stringify({ jobId: "job_123", url: "https://neon.com" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      domain: "neon.com",
      files: {
        tokens: "neon.com/job_123/tokens.json",
        designMd: "neon.com/job_123/DESIGN.md",
        brandGuide: "neon.com/job_123/brand-guide.pdf",
      },
    });
  });
});
