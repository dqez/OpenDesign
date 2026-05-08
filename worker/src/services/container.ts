import type { Env } from "../types";

export type ContainerResult = {
  ok: boolean;
  domain: string;
  files: {
    tokens: string;
    designMd: string;
    brandGuide: string;
  };
};

export async function runContainerExtraction(
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
    throw new Error(`extractor_failed:${response.status}:${errorBody}`);
  }
  return response.json<ContainerResult>();
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
