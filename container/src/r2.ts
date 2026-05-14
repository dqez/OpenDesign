import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

function createR2Client() {
  return new S3Client({
    region: "auto",
    endpoint:
      process.env.R2_ENDPOINT ??
      `https://${requiredEnv("CF_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

export async function uploadObject(
  key: string,
  body: Uint8Array,
  contentType: string,
) {
  await createR2Client().send(
    new PutObjectCommand({
      Bucket: requiredEnv("R2_BUCKET_NAME"),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
