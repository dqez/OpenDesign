import { expect, it } from "vitest";
import {
  getAppConfig,
  getClientJobsStorageKey,
  getToastCollapsedStorageKey,
} from "./app-config";

it("reads frontend brand config from Vite env with OpenDesign defaults", () => {
  expect(
    getAppConfig({
      VITE_APP_NAME: "InjectedDesign",
      VITE_APP_GLYPH: "ID",
      VITE_STORAGE_PREFIX: "injected",
    }),
  ).toEqual({
    appName: "InjectedDesign",
    appGlyph: "ID",
    storagePrefix: "injected",
  });

  expect(getAppConfig({})).toEqual({
    appName: "OpenDesign",
    appGlyph: "OD",
    storagePrefix: "opendesign",
  });
});

it("builds storage keys from configured prefix", () => {
  expect(getClientJobsStorageKey("injected")).toBe("injected.extract.jobs.v1");
  expect(getToastCollapsedStorageKey("injected")).toBe(
    "injected.extract.toast-collapsed.v1",
  );
});
