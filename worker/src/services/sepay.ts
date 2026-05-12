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
}) {
  const params = new URLSearchParams({
    acc: input.accountNumber,
    bank: input.bankName,
    amount: String(Math.floor(input.amount)),
    des: input.orderCode,
  });
  return `https://qr.sepay.vn/img?${params.toString()}`;
}

export function extractOrderCodeFromWebhook(
  payload: Pick<SePayWebhookPayload, "code" | "content">,
) {
  return normalizeOrderCode(payload.code) ?? normalizeOrderCode(payload.content);
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

export const SEPAY_ALLOWED_IPS = [
  "172.236.138.20",
  "172.233.83.68",
  "171.244.35.2",
  "151.158.108.68",
  "151.158.109.79",
  "103.255.238.139",
];

export function isAllowedSePayIp(ip: string) {
  return SEPAY_ALLOWED_IPS.includes(ip);
}

function normalizeOrderCode(value: string | null | undefined) {
  const match = value?.match(/(?:OD|2D)-?[A-Z0-9]{6}/i);
  if (!match) return null;

  const compactOrderCode = match[0].replace("-", "").toUpperCase();
  return `${compactOrderCode.slice(0, 2)}-${compactOrderCode.slice(2)}`;
}

function constantTimeEqual(a: string, b: string) {
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let index = 0; index < max; index += 1) {
    diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return diff === 0;
}
