import { describe, expect, it } from "vitest";
import app from "../src/app";

const env = {
  FRONTEND_ORIGIN: "https://opendesign.pages.dev",
  DEV_ORIGIN: "http://localhost:5173",
  DEV_ORIGINS: "http://localhost:5173,http://127.0.0.1:5173",
};

describe("apiCors", () => {
  it("echoes the production frontend origin", async () => {
    const response = await app.request(
      "/api/health",
      { headers: { origin: "https://opendesign.pages.dev" } },
      env,
    );

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://opendesign.pages.dev",
    );
  });

  it("echoes localhost Vite origin", async () => {
    const response = await app.request(
      "/api/health",
      { headers: { origin: "http://localhost:5173" } },
      env,
    );

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
  });

  it("echoes 127.0.0.1 Vite origin", async () => {
    const response = await app.request(
      "/api/health",
      { headers: { origin: "http://127.0.0.1:5173" } },
      env,
    );

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://127.0.0.1:5173",
    );
  });
});
