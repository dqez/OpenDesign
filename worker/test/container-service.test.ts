import { afterEach, describe, expect, it, vi } from "vitest";
import { runContainerExtraction } from "../src/services/container";

describe("runContainerExtraction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the configured external extractor with bearer auth", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          ok: true,
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

    const result = await runContainerExtraction(
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
    expect(result.files.tokens).toBe("neon.com/job_123/tokens.json");
  });

  it("throws with response body when extractor fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("dembrandt failed", { status: 500 })),
    );

    await expect(
      runContainerExtraction(
        {
          EXTRACTOR_URL: "https://extractor.example.com",
          EXTRACTOR_API_KEY: "shared-secret",
        } as never,
        { jobId: "job_123", url: "https://neon.com" },
      ),
    ).rejects.toThrow("extractor_failed:500:dembrandt failed");
  });
});
