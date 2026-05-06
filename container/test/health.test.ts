import { expect, it } from "vitest";
import { healthPayload } from "../src/health.js";

it("returns container health status", () => {
  expect(healthPayload()).toEqual({
    ok: true,
    service: "2design-dembrandt-container",
  });
});
