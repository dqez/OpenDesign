import { expect, it } from "vitest";
import { healthPayload } from "../src/health.js";

it("returns container health status", () => {
  expect(healthPayload()).toEqual({
    ok: true,
    service: "opendesign-dembrandt-container",
  });
});
