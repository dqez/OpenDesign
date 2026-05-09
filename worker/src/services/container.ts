import type { Env } from "../types";

export type ContainerFiles = {
  tokens: string;
  designMd: string;
  brandGuide: string;
};

export type ContainerExtractionStatus =
  | {
      ok: true;
      jobId: string;
      status: "processing";
    }
  | {
      ok: true;
      jobId: string;
      status: "completed";
      domain: string;
      files: ContainerFiles;
    }
  | {
      ok: false;
      jobId: string;
      status: "failed";
      error: string;
    };

export async function startContainerExtraction(
  env: Env,
  payload: { jobId: string; url: string },
) {
  const response = await fetch(joinUrl(env.EXTRACTOR_URL, "/extract"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.EXTRACTOR_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`extractor_start_failed:${response.status}:${errorBody}`);
  }
  return response.json<ContainerExtractionStatus>();
}

export async function getContainerExtractionStatus(env: Env, jobId: string) {
  const response = await fetch(
    joinUrl(env.EXTRACTOR_URL, `/extract/jobs/${encodeURIComponent(jobId)}`),
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${env.EXTRACTOR_API_KEY}`,
      },
    },
  );
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`extractor_poll_failed:${response.status}:${errorBody}`);
  }
  return response.json<ContainerExtractionStatus>();
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
