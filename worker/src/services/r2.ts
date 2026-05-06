import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Env } from "../types";

export type R2ObjectUrlInput = {
  accountId: string;
  bucketName: string;
  key: string;
};

export type R2Files = {
  tokens: string;
  designMd: string;
  brandGuide: string;
};

export function buildR2ObjectUrl(input: R2ObjectUrlInput) {
  return `https://${input.accountId}.r2.cloudflarestorage.com/${input.bucketName}/${input.key}`;
}

export function createR2S3Client(env: Env) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function createSignedGetUrl(
  env: Env,
  key: string,
  expiresInSeconds = 86_400,
) {
  return getSignedUrl(
    createR2S3Client(env),
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

export async function createSignedFileUrls(env: Env, files: R2Files) {
  return {
    tokens: await createSignedGetUrl(env, files.tokens),
    designMd: await createSignedGetUrl(env, files.designMd),
    brandGuide: await createSignedGetUrl(env, files.brandGuide),
  };
}
