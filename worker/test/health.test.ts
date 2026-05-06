import { expect, it } from "vitest";
import app from "../src/app";

it("returns health status", async () => {
  const response = await app.request("/api/health");
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    ok: true,
    service: "2design-api",
  });
});
