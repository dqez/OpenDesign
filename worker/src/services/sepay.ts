export type SePayWebhookPayload = {
  id: number | string;
  code?: string;
  content?: string;
  transferType?: string;
  transferAmount?: number;
  referenceCode?: string;
};

export function buildSePayQrUrl(input: {
  bankName: string;
  accountNumber: string;
  amount: number;
  orderCode: string;
}) {
  const params = new URLSearchParams({
    acc: input.accountNumber,
    bank: input.bankName,
    amount: String(input.amount),
    des: input.orderCode,
  });
  return `https://qr.sepay.vn/img?${params.toString()}`;
}

export function extractOrderCodeFromWebhook(
  payload: Pick<SePayWebhookPayload, "code" | "content">,
) {
  if (payload.code?.startsWith("2D-")) return payload.code;
  return payload.content?.match(/2D-[A-Z0-9]{6}/)?.[0] ?? null;
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

function constantTimeEqual(a: string, b: string) {
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let index = 0; index < max; index += 1) {
    diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return diff === 0;
}
