import { getContainer } from "@cloudflare/containers";
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
  const container = getContainer(env.DEMBRANDT_CONTAINER, payload.jobId);
  const response = await container.fetch(
    new Request("http://container/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
  if (!response.ok) {
    throw new Error(`container_extract_failed:${response.status}`);
  }
  return response.json<ContainerResult>();
}
