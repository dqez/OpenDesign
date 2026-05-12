import { afterEach, expect, it } from "vitest";
import { healthPayload } from "../src/health.js";

afterEach(() => {
  delete process.env.CONTAINER_SERVICE_NAME;
});

it("returns container health status", () => {
  expect(healthPayload()).toEqual({
    ok: true,
    service: "opendesign-dembrandt-container",
  });
});

it("uses configured container service name", () => {
  process.env.CONTAINER_SERVICE_NAME = "custom-container";

  expect(healthPayload()).toEqual({
    ok: true,
    service: "custom-container",
  });
});
