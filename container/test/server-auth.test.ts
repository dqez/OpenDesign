import { beforeEach, describe, expect, it, vi } from "vitest";

const runDembrandtMock = vi.fn();
const uploadObjectMock = vi.fn();

vi.mock("../src/execute.js", () => ({
  buildOutputKeys: (domain: string, jobId: string) => ({
    tokens: `${domain}/${jobId}/tokens.json`,
    designMd: `${domain}/${jobId}/DESIGN.md`,
    brandGuide: `${domain}/${jobId}/brand-guide.pdf`,
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

  it("accepts extract requests with the correct bearer token without waiting for extraction", async () => {
    const extraction = deferred<{
      domain: string;
      files: {
        tokens: Uint8Array;
        designMd: Uint8Array;
        brandGuide: Uint8Array;
      };
    }>();
    runDembrandtMock.mockReturnValue(extraction.promise);
    uploadObjectMock.mockResolvedValue(undefined);
    const { app } = await import("../src/server.js");

    const response = await app.request("/extract", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer shared-secret",
      },
      body: JSON.stringify({ jobId: "job_async", url: "https://neon.com" }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      ok: true,
      jobId: "job_async",
      status: "processing",
    });

    const statusResponse = await app.request("/extract/jobs/job_async", {
      headers: { authorization: "Bearer shared-secret" },
    });
    expect(statusResponse.status).toBe(200);
    expect(await statusResponse.json()).toEqual({
      ok: true,
      jobId: "job_async",
      status: "processing",
    });

    extraction.resolve({
      domain: "neon.com",
      files: {
        tokens: new Uint8Array([123, 125]),
        designMd: new Uint8Array([35]),
        brandGuide: new Uint8Array([37]),
      },
    });
    await waitFor(() => expect(uploadObjectMock).toHaveBeenCalledTimes(3));

    const completedResponse = await app.request("/extract/jobs/job_async", {
      headers: { authorization: "Bearer shared-secret" },
    });
    expect(completedResponse.status).toBe(200);
    expect(await completedResponse.json()).toEqual({
      ok: true,
      jobId: "job_async",
      status: "completed",
      domain: "neon.com",
      files: {
        tokens: "neon.com/job_async/tokens.json",
        designMd: "neon.com/job_async/DESIGN.md",
        brandGuide: "neon.com/job_async/brand-guide.pdf",
      },
    });
  });

  it("records failed extraction jobs for polling", async () => {
    runDembrandtMock.mockRejectedValue(new Error("dembrandt boom"));
    const { app } = await import("../src/server.js");

    const response = await app.request("/extract", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer shared-secret",
      },
      body: JSON.stringify({ jobId: "job_failed", url: "https://neon.com" }),
    });

    expect(response.status).toBe(202);
    await waitFor(async () => {
      const statusResponse = await app.request("/extract/jobs/job_failed", {
        headers: { authorization: "Bearer shared-secret" },
      });
      expect(await statusResponse.json()).toEqual({
        ok: false,
        jobId: "job_failed",
        status: "failed",
        error: "dembrandt boom",
      });
    });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function waitFor(assertion: () => void | Promise<void>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }
  throw lastError;
}
