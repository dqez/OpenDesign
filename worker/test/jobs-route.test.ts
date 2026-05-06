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
