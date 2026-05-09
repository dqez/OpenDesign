import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getContainerExtractionStatus,
  startContainerExtraction,
} from "../src/services/container";

describe("extractor service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts extraction through the configured external extractor with bearer auth", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          ok: true,
          jobId: "job_123",
          status: "processing",
        }),
        { status: 202, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await startContainerExtraction(
      {
        EXTRACTOR_URL: "https://extractor.example.com/",
        EXTRACTOR_API_KEY: "shared-secret",
      } as never,
      { jobId: "job_123", url: "https://neon.com" },
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const firstCall = fetchMock.mock.calls[0]!;
    const url = firstCall[0];
    const init = firstCall[1]!;
    expect(url).toBe("https://extractor.example.com/extract");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "content-type": "application/json",
      authorization: "Bearer shared-secret",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      jobId: "job_123",
      url: "https://neon.com",
    });
    expect(result).toEqual({
      ok: true,
      jobId: "job_123",
      status: "processing",
    });
  });

  it("polls extraction status through the configured external extractor", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          ok: true,
          jobId: "job_123",
          status: "completed",
          domain: "neon.com",
          files: {
            tokens: "neon.com/job_123/tokens.json",
            designMd: "neon.com/job_123/DESIGN.md",
            brandGuide: "neon.com/job_123/brand-guide.pdf",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getContainerExtractionStatus(
      {
        EXTRACTOR_URL: "https://extractor.example.com/",
        EXTRACTOR_API_KEY: "shared-secret",
      } as never,
      "job_123",
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const firstCall = fetchMock.mock.calls[0]!;
    expect(firstCall[0]).toBe("https://extractor.example.com/extract/jobs/job_123");
    expect(firstCall[1]).toEqual({
      method: "GET",
      headers: {
        authorization: "Bearer shared-secret",
      },
    });
    expect(result.status).toBe("completed");
  });

  it("throws with response body when extractor start fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("dembrandt failed", { status: 500 })),
    );

    await expect(
      startContainerExtraction(
        {
          EXTRACTOR_URL: "https://extractor.example.com",
          EXTRACTOR_API_KEY: "shared-secret",
        } as never,
        { jobId: "job_123", url: "https://neon.com" },
      ),
    ).rejects.toThrow("extractor_start_failed:500:dembrandt failed");
  });

  it("throws with response body when extractor polling fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 })),
    );

    await expect(
      getContainerExtractionStatus(
        {
          EXTRACTOR_URL: "https://extractor.example.com",
          EXTRACTOR_API_KEY: "shared-secret",
        } as never,
        "job_123",
      ),
    ).rejects.toThrow("extractor_poll_failed:404:not found");
  });
});
