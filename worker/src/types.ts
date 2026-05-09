export type ExtractionPayload = {
  jobId: string;
  url: string;
  email: string;
};

export type Env = {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  EXTRACT_QUEUE: Queue<ExtractionPayload>;
  EXTRACTION_WORKFLOW: Workflow<ExtractionPayload>;
  IP_HASH_SALT: string;
  SEPAY_API_KEY: string;
  RESEND_API_KEY: string;
  CF_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  EXTRACTOR_URL: string;
  EXTRACTOR_API_KEY: string;
  FRONTEND_ORIGIN: string;
  DEV_ORIGIN: string;
  DEV_ORIGINS: string;
  SEPAY_BANK_ACCOUNT: string;
  SEPAY_BANK_NAME: string;
  SEPAY_BANK_ACCOUNT_NAME: string;
};

export type AppEnv = { Bindings: Env };
