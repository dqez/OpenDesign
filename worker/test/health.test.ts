import { expect, it } from "vitest";
import app from "../src/app";

it("returns health status", async () => {
  const response = await app.request("/api/health", {}, {
    FRONTEND_ORIGIN: "https://opendesign.pages.dev",
    DEV_ORIGIN: "http://localhost:5173",
  });
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    ok: true,
    service: "opendesign-api",
  });
});
