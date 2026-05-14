type FrontendEnv = Partial<Record<string, string>>;

export type AppConfig = {
  appName: string;
  appGlyph: string;
  storagePrefix: string;
};

export function getAppConfig(env: FrontendEnv = import.meta.env): AppConfig {
  const appName = nonEmpty(env.VITE_APP_NAME) ?? "OpenDesign";
  return {
    appName,
    appGlyph: nonEmpty(env.VITE_APP_GLYPH) ?? "OD",
    storagePrefix: nonEmpty(env.VITE_STORAGE_PREFIX) ?? slugify(appName),
  };
}

export function getClientJobsStorageKey(
  storagePrefix = appConfig.storagePrefix,
) {
  return `${storagePrefix}.extract.jobs.v1`;
}

export function getToastCollapsedStorageKey(
  storagePrefix = appConfig.storagePrefix,
) {
  return `${storagePrefix}.extract.toast-collapsed.v1`;
}

export const appConfig = getAppConfig();

function nonEmpty(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "opendesign";
}
