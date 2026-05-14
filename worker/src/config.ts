export const DEFAULT_APP_NAME = "OpenDesign";
export const DEFAULT_EMAIL_FROM = "OpenDesign <no-reply@example.com>";
export const DEFAULT_LEGACY_ORDER_CODE_PREFIXES = "2D";
export const DEFAULT_ORDER_CODE_PREFIX = "OD";
export const DEFAULT_ORDER_TTL_HOURS = 24;
export const DEFAULT_PAID_EXTRACTION_AMOUNT = 25_000;
export const DEFAULT_PAYMENT_CURRENCY = "VND";
export const DEFAULT_PAYMENT_REQUIRED_MESSAGE =
  "Ban da su dung luot mien phi. Chuyen khoan 25.000d de tiep tuc.";
export const DEFAULT_SEPAY_ALLOWED_IPS =
  "172.236.138.20,172.233.83.68,171.244.35.2,151.158.108.68,151.158.109.79,103.255.238.139";
export const DEFAULT_SEPAY_QR_BASE_URL = "https://qr.sepay.vn/img";
export const DEFAULT_SERVICE_NAME = "opendesign-api";

type ConfigKey =
  | "APP_NAME"
  | "CF_ACCOUNT_ID"
  | "EMAIL_FROM"
  | "LEGACY_ORDER_CODE_PREFIXES"
  | "ORDER_CODE_PREFIX"
  | "ORDER_TTL_HOURS"
  | "PAID_EXTRACTION_AMOUNT"
  | "PAYMENT_CURRENCY"
  | "PAYMENT_REQUIRED_MESSAGE"
  | "R2_ENDPOINT"
  | "SEPAY_ALLOWED_IPS"
  | "SEPAY_QR_BASE_URL"
  | "SERVICE_NAME";

type ConfigEnv = Partial<Record<ConfigKey, string>>;

export function getAppName(env: ConfigEnv) {
  return nonEmpty(env.APP_NAME) ?? DEFAULT_APP_NAME;
}

export function getEmailFrom(env: ConfigEnv) {
  return nonEmpty(env.EMAIL_FROM) ?? DEFAULT_EMAIL_FROM;
}

export function getLegacyOrderCodePrefixes(env: ConfigEnv) {
  return splitCsv(
    nonEmpty(env.LEGACY_ORDER_CODE_PREFIXES) ??
      DEFAULT_LEGACY_ORDER_CODE_PREFIXES,
  ).map(normalizeOrderCodePrefix);
}

export function getOrderCodePrefix(env: ConfigEnv) {
  return normalizeOrderCodePrefix(
    nonEmpty(env.ORDER_CODE_PREFIX) ?? DEFAULT_ORDER_CODE_PREFIX,
  );
}

export function getOrderTtlHours(env: ConfigEnv) {
  return positiveNumber(env.ORDER_TTL_HOURS, DEFAULT_ORDER_TTL_HOURS);
}

export function getPaidExtractionAmount(env: ConfigEnv) {
  return positiveNumber(
    env.PAID_EXTRACTION_AMOUNT,
    DEFAULT_PAID_EXTRACTION_AMOUNT,
  );
}

export function getPaymentCurrency(env: ConfigEnv) {
  return nonEmpty(env.PAYMENT_CURRENCY) ?? DEFAULT_PAYMENT_CURRENCY;
}

export function getPaymentRequiredMessage(env: ConfigEnv) {
  return (
    nonEmpty(env.PAYMENT_REQUIRED_MESSAGE) ?? DEFAULT_PAYMENT_REQUIRED_MESSAGE
  );
}

export function getR2Endpoint(env: ConfigEnv) {
  return (
    nonEmpty(env.R2_ENDPOINT) ??
    `https://${nonEmpty(env.CF_ACCOUNT_ID) ?? ""}.r2.cloudflarestorage.com`
  );
}

export function getSePayAllowedIps(env: ConfigEnv) {
  return nonEmpty(env.SEPAY_ALLOWED_IPS) ?? DEFAULT_SEPAY_ALLOWED_IPS;
}

export function getSePayQrBaseUrl(env: ConfigEnv) {
  return nonEmpty(env.SEPAY_QR_BASE_URL) ?? DEFAULT_SEPAY_QR_BASE_URL;
}

export function getServiceName(env: ConfigEnv) {
  return nonEmpty(env.SERVICE_NAME) ?? DEFAULT_SERVICE_NAME;
}

function nonEmpty(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeOrderCodePrefix(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function positiveNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
