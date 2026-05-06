import { Buffer } from "node:buffer";

export async function uploadObject(
  key: string,
  body: Uint8Array,
  contentType: string,
) {
  const response = await fetch(`http://r2.internal/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: Buffer.from(body),
  });
  if (!response.ok) {
    throw new Error(`r2_upload_failed:${response.status}:${key}`);
  }
}
