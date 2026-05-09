export type ExtractResponse =
  | { jobId: string; status: "queued"; pollUrl: string }
  | {
      requiresPayment: true;
      orderCode: string;
      amount: number;
      bankInfo: {
        bank: string;
        accountNumber: string;
        accountName: string;
        content: string;
      };
      qrUrl: string;
      orderStatusUrl: string;
    };

export type OrderStatusResponse = {
  orderCode: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  amount: number;
  currency: string;
  expiresAt: string;
  paidAt: string | null;
  jobId: string | null;
  pollUrl: string | null;
};

export type JobResponse = {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  files?: {
    tokens?: { url: string; size?: number };
    designMd?: { url: string; size?: number };
    brandGuide?: { url: string; size?: number };
  };
  failureReason?: string;
};

export type DesignCatalogItem = {
  slug: string;
  brand: string;
  sourceUrl: string;
  designMdUrl?: string;
  tokensUrl?: string;
  brandGuideUrl?: string;
  updatedAt?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function createExtraction(input: {
  url: string;
  email: string;
}): Promise<ExtractResponse> {
  const response = await fetch(`${API_BASE}/api/extract`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (response.status !== 202 && response.status !== 402) {
    throw new Error(`extract_failed:${response.status}`);
  }
  return response.json();
}

export async function getJob(jobId: string): Promise<JobResponse> {
  const response = await fetch(`${API_BASE}/api/jobs/${jobId}`);
  if (!response.ok) throw new Error(`job_failed:${response.status}`);
  return response.json();
}

export async function getOrderStatus(
  orderCode: string,
): Promise<OrderStatusResponse> {
  const response = await fetch(`${API_BASE}/api/orders/${orderCode}`);
  if (!response.ok) throw new Error(`order_failed:${response.status}`);
  return response.json();
}

export async function getDesignCatalog(): Promise<DesignCatalogItem[]> {
  const response = await fetch(`${API_BASE}/api/designs`);
  if (!response.ok) throw new Error(`designs_failed:${response.status}`);
  if (!isJsonResponse(response)) throw new Error("designs_unavailable");
  try {
    return await response.json();
  } catch {
    throw new Error("designs_unavailable");
  }
}

function isJsonResponse(response: Response) {
  return response.headers.get("content-type")?.includes("application/json");
}
