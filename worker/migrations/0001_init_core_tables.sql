CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  email TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  paid INTEGER NOT NULL DEFAULT 0,
  order_code TEXT,
  r2_keys TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  order_code TEXT PRIMARY KEY,
  job_id TEXT,
  url TEXT NOT NULL,
  email TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  created_at TEXT NOT NULL,
  paid_at TEXT,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id TEXT PRIMARY KEY,
  order_code TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  reference_code TEXT,
  amount INTEGER NOT NULL,
  raw_payload TEXT NOT NULL,
  received_at TEXT NOT NULL,
  verified_at TEXT,
  UNIQUE (provider, provider_transaction_id)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  webhook_event_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  order_code TEXT,
  status TEXT NOT NULL CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  raw_payload TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS email_logs (
  email_log_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  email TEXT NOT NULL,
  template TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
  error TEXT,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  event_id TEXT PRIMARY KEY,
  job_id TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'provider')),
  event_type TEXT NOT NULL,
  metadata TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_email ON jobs(email);
CREATE INDEX IF NOT EXISTS idx_jobs_domain ON jobs(domain);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_status_expires ON orders(status, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_transaction ON payments(provider, provider_transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_event ON webhook_events(provider, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_job_status ON email_logs(job_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_events_job_created ON audit_events(job_id, created_at);
