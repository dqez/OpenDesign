import { describe, expect, it, vi } from "vitest";
import app from "../src/app";

describe("GET /api/designs", () => {
  it("signs detail asset URLs and keeps paginated R2 listing", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        objects: [
          {
            key: "senlyzer.vn/job_old/DESIGN.md",
            uploaded: new Date("2026-05-08T00:00:00.000Z"),
          },
        ],
        truncated: true,
        cursor: "next-page",
      })
      .mockResolvedValueOnce({
        objects: [
          {
            key: "senlyzer.vn/job_new/DESIGN.md",
            uploaded: new Date("2026-05-09T00:00:00.000Z"),
          },
          {
            key: "senlyzer.vn/job_new/tokens.json",
            uploaded: new Date("2026-05-09T00:00:00.000Z"),
          },
          {
            key: "senlyzer.vn/job_new/brand-guide.pdf",
            uploaded: new Date("2026-05-09T00:00:00.000Z"),
          },
        ],
        truncated: false,
      });

    const response = await app.request("/api/designs", {}, mockEnv(list));

    expect(response.status).toBe(200);
    expect(list).toHaveBeenNthCalledWith(1, { cursor: undefined });
    expect(list).toHaveBeenNthCalledWith(2, { cursor: "next-page" });

    const body = (await response.json()) as Array<{
      slug: string;
      designMdUrl: string;
      tokensUrl: string;
      brandGuideUrl?: string;
    }>;
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      slug: "senlyzer",
      designMdUrl: expect.stringContaining("senlyzer.vn/job_new/DESIGN.md"),
      tokensUrl: expect.stringContaining("senlyzer.vn/job_new/tokens.json"),
      brandGuideUrl: expect.stringContaining(
        "senlyzer.vn/job_new/brand-guide.pdf",
      ),
    });
  });

  it("omits catalog items that do not have sibling tokens", async () => {
    const list = vi.fn().mockResolvedValue({
      objects: [
        {
          key: "neon.com/job_1/DESIGN.md",
          uploaded: new Date("2026-05-09T00:00:00.000Z"),
        },
        {
          key: "supabase.com/job_1/DESIGN.md",
          uploaded: new Date("2026-05-09T00:00:00.000Z"),
        },
        {
          key: "supabase.com/job_1/tokens.json",
          uploaded: new Date("2026-05-09T00:00:00.000Z"),
        },
      ],
      truncated: false,
    });

    const response = await app.request("/api/designs", {}, mockEnv(list));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({
        slug: "supabase",
        tokensUrl: expect.stringContaining("supabase.com/job_1/tokens.json"),
      }),
    ]);
  });
});

function mockEnv(list: ReturnType<typeof vi.fn>) {
  return {
    R2: { list },
    CF_ACCOUNT_ID: "abc123",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET_NAME: "opendesign-outputs",
    FRONTEND_ORIGIN: "https://opendesign.pages.dev",
    DEV_ORIGIN: "http://localhost:5173",
    DEV_ORIGINS: "http://localhost:5173,http://127.0.0.1:5173",
  };
}
