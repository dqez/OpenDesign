import { expect, it } from "vitest";
import app from "../src/app";
import { mockEnvWithNoJob } from "./route-mocks";

it("returns 404 for missing job", async () => {
  const response = await app.request(
    "/api/jobs/job_missing",
    {},
    mockEnvWithNoJob(),
  );
  expect(response.status).toBe(404);
  await expect(response.json()).resolves.toEqual({ error: "job_not_found" });
});

it("returns signed file URLs for completed jobs", async () => {
  const first = async () => ({
    job_id: "job_123",
    status: "completed",
    r2_keys: JSON.stringify({
      tokens: "neon.com/job_123/tokens.json",
      designMd: "neon.com/job_123/DESIGN.md",
      brandGuide: "neon.com/job_123/brand-guide.pdf",
    }),
  });
  const bind = () => ({ first });
  const prepare = () => ({ bind });

  const response = await app.request(
    "/api/jobs/job_123",
    {},
    {
      DB: { prepare },
      CF_ACCOUNT_ID: "abc123",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET_NAME: "opendesign-outputs",
      FRONTEND_ORIGIN: "https://opendesign.pages.dev",
      DEV_ORIGIN: "http://localhost:5173",
    },
  );

  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    files: { tokens: { url: string } };
  };
  expect(body.files.tokens.url).toContain("neon.com/job_123/tokens.json");
});
