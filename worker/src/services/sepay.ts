import {
  DEFAULT_LEGACY_ORDER_CODE_PREFIXES,
  DEFAULT_ORDER_CODE_PREFIX,
  DEFAULT_SEPAY_ALLOWED_IPS,
  DEFAULT_SEPAY_QR_BASE_URL,
} from "../config";

export type SePayWebhookPayload = {
  id: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  code?: string | null;
  content?: string | null;
  transferType?: string;
  transferAmount?: number;
  accumulated?: number;
  subAccount?: string | null;
  referenceCode?: string;
};

export type SePayAmountStatus = "paid" | "overpaid" | "underpaid";

export function buildSePayQrUrl(input: {
  bankName: string;
  accountNumber: string;
  amount: number;
  orderCode: string;
  qrBaseUrl?: string;
}) {
  const params = new URLSearchParams({
    acc: input.accountNumber,
    bank: input.bankName,
    amount: String(Math.floor(input.amount)),
    des: input.orderCode,
  });
  return `${input.qrBaseUrl ?? DEFAULT_SEPAY_QR_BASE_URL}?${params.toString()}`;
}

export function extractOrderCodeFromWebhook(
  payload: Pick<SePayWebhookPayload, "code" | "content">,
  prefixes = [DEFAULT_ORDER_CODE_PREFIX, DEFAULT_LEGACY_ORDER_CODE_PREFIXES],
) {
  return (
    normalizeOrderCode(payload.code, prefixes) ??
    normalizeOrderCode(payload.content, prefixes)
  );
}

export function classifySePayAmount(
  transferAmount: number,
  expectedAmount: number,
): SePayAmountStatus {
  if (transferAmount < expectedAmount) return "underpaid";
  if (transferAmount > expectedAmount) return "overpaid";
  return "paid";
}

export function isExpectedSePayAccount(
  payloadAccountNumber: string | undefined,
  expectedAccountNumber: string,
) {
  if (!payloadAccountNumber) return true;
  return payloadAccountNumber === expectedAccountNumber;
}

export function verifySePayAuthorization(
  header: string | null,
  apiKey: string,
) {
  return constantTimeEqual(header ?? "", `Apikey ${apiKey}`);
}

export function isAllowedSePayIp(
  ip: string,
  allowedIps = DEFAULT_SEPAY_ALLOWED_IPS,
) {
  return splitCsv(allowedIps).includes(ip);
}

function normalizeOrderCode(
  value: string | null | undefined,
  prefixes: string[],
) {
  const normalizedPrefixes = prefixes.map(normalizePrefix).filter(Boolean);
  const match = value?.match(
    new RegExp(`(?:${normalizedPrefixes.join("|")})-?[A-Z0-9]{6}`, "i"),
  );
  if (!match) return null;

  const compactOrderCode = match[0].replace("-", "").toUpperCase();
  const prefix = normalizedPrefixes.find((item) =>
    compactOrderCode.startsWith(item),
  );
  if (!prefix) return null;
  return `${prefix}-${compactOrderCode.slice(prefix.length)}`;
}

function normalizePrefix(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function constantTimeEqual(a: string, b: string) {
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let index = 0; index < max; index += 1) {
    diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return diff === 0;
}
