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
