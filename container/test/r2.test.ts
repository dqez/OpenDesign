import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadObject } from "../src/r2.js";

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return {
    ...actual,
    S3Client: vi.fn(() => ({ send: sendMock })),
  };
});

describe("uploadObject", () => {
  beforeEach(() => {
    sendMock.mockReset();
    vi.mocked(S3Client).mockClear();
    process.env.CF_ACCOUNT_ID = "account123";
    process.env.R2_ACCESS_KEY_ID = "access123";
    process.env.R2_SECRET_ACCESS_KEY = "secret123";
    process.env.R2_BUCKET_NAME = "2design-outputs";
  });

  it("uploads an object through the R2 S3 API", async () => {
    sendMock.mockResolvedValue({});

    await uploadObject(
      "neon.com/job_123/tokens.json",
      new Uint8Array([123, 125]),
      "application/json",
    );

    expect(S3Client).toHaveBeenCalledWith({
      region: "auto",
      endpoint: "https://account123.r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: "access123",
        secretAccessKey: "secret123",
      },
    });
    expect(sendMock).toHaveBeenCalledOnce();
    const command = sendMock.mock.calls[0][0] as PutObjectCommand;
    expect(command.input).toMatchObject({
      Bucket: "2design-outputs",
      Key: "neon.com/job_123/tokens.json",
      Body: new Uint8Array([123, 125]),
      ContentType: "application/json",
    });
  });
});
