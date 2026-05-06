# Phase 4 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Vite SPA that submits extraction requests, shows payment instructions, polls job status, and previews completed outputs.

**Architecture:** The frontend is a static React app for Cloudflare Pages. It talks only to the Worker API and stores the current `jobId` or payment state in component state plus URL route params.

**Tech Stack:** Vite, React, React Router, TypeScript, CSS, Vitest.

---

## Task 4.1: API Client

**Files:**
- Create: `frontend/src/api.ts`
- Create: `frontend/src/api.test.ts`

- [ ] **Step 1: Implement typed API client**

```ts
export type ExtractResponse =
  | { jobId: string; status: "queued"; pollUrl: string }
  | {
      requiresPayment: true;
      orderCode: string;
      amount: number;
      bankInfo: { bank: string; accountNumber: string; accountName: string; content: string };
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

export async function createExtraction(input: { url: string; email: string }): Promise<ExtractResponse> {
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
```

- [ ] **Step 2: Verify**

Run:

```bash
cd frontend
npm test -- api.test.ts
npm run build
```

Expected: API tests pass and build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api.ts frontend/src/api.test.ts
git commit -m "feat: add frontend API client"
```

## Task 4.2: Home Submit and Payment State

**Files:**
- Create: `frontend/src/pages/Home.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Implement Home page**

```tsx
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createExtraction, type ExtractResponse } from "../api";

export function Home() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [payment, setPayment] = useState<Extract<ExtractResponse, { requiresPayment: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await createExtraction({ url, email });
      if ("requiresPayment" in response) {
        setPayment(response);
      } else {
        navigate(`/jobs/${response.jobId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <form className="extract-panel" onSubmit={onSubmit}>
        <label>
          Website URL
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://neon.com" required />
        </label>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="user@example.com" type="email" required />
        </label>
        <button disabled={submitting}>{submitting ? "Submitting" : "Extract"}</button>
        {error ? <p className="error">{error}</p> : null}
      </form>
      {payment ? (
        <section className="payment-panel">
          <img src={payment.qrUrl} alt={`Payment QR for ${payment.orderCode}`} />
          <dl>
            <dt>Order</dt>
            <dd>{payment.orderCode}</dd>
            <dt>Amount</dt>
            <dd>{payment.amount.toLocaleString("vi-VN")} VND</dd>
          </dl>
        </section>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 2: Wire router**

`frontend/src/App.tsx`:

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Verify**

Run:

```bash
cd frontend
npm run build
```

Expected: build succeeds and Home route compiles.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat: add extraction submit UI"
```

## Task 4.3: Status Polling

**Files:**
- Create: `frontend/src/pages/Status.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Implement Status page**

```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getJob, type JobResponse } from "../api";

export function Status() {
  const { jobId = "" } = useParams();
  const [job, setJob] = useState<JobResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const next = await getJob(jobId);
        if (!active) return;
        setJob(next);
        if (next.status === "queued" || next.status === "processing") {
          window.setTimeout(poll, 3000);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Polling failed");
      }
    }
    poll();
    return () => {
      active = false;
    };
  }, [jobId]);

  if (error) return <main className="app-shell"><p className="error">{error}</p></main>;
  if (!job) return <main className="app-shell">Loading</main>;

  return (
    <main className="app-shell">
      <h1>{job.status}</h1>
      {job.status === "completed" ? <Link to={`/jobs/${jobId}/preview`}>Open preview</Link> : null}
      {job.status === "failed" ? <p className="error">{job.failureReason}</p> : null}
    </main>
  );
}
```

- [ ] **Step 2: Wire status route**

`frontend/src/App.tsx`:

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { Status } from "./pages/Status";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/jobs/:jobId" element={<Status />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Verify**

Run:

```bash
cd frontend
npm run build
```

Expected: build succeeds; status route compiles.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat: add job status polling UI"
```

## Task 4.4: Rich Token Preview and Downloads

**Files:**
- Create: `frontend/src/pages/Preview.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Implement Preview page**

```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getJob, type JobResponse } from "../api";

type TokenValue = { value?: unknown; type?: string; $value?: unknown; $type?: string };
type TokenTree = Record<string, TokenValue | TokenTree>;

function flattenTokens(tree: TokenTree, prefix = ""): Array<{ name: string; value: unknown; type?: string }> {
  return Object.entries(tree).flatMap(([key, raw]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    const token = raw as TokenValue;
    if ("value" in token || "$value" in token) {
      return [{ name, value: token.value ?? token.$value, type: token.type ?? token.$type }];
    }
    return flattenTokens(raw as TokenTree, name);
  });
}

function isColor(value: unknown) {
  return typeof value === "string" && /^#([0-9a-f]{3,8})$/i.test(value);
}

export function Preview() {
  const { jobId = "" } = useParams();
  const [job, setJob] = useState<JobResponse | null>(null);
  const [tokens, setTokens] = useState<Array<{ name: string; value: unknown; type?: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const next = await getJob(jobId);
        setJob(next);
        if (next.files?.tokens?.url) {
          const response = await fetch(next.files.tokens.url);
          const tokenJson = (await response.json()) as TokenTree;
          setTokens(flattenTokens(tokenJson));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Preview failed");
      }
    }
    load();
  }, [jobId]);

  if (error) return <main className="app-shell"><p className="error">{error}</p></main>;
  if (!job?.files) return <main className="app-shell">No files available</main>;

  const colors = tokens.filter((token) => isColor(token.value));
  const typography = tokens.filter((token) => token.name.toLowerCase().includes("font") || token.type === "typography");
  const spacing = tokens.filter((token) => token.name.toLowerCase().includes("spacing") || token.name.toLowerCase().includes("space"));
  const effects = tokens.filter((token) => token.name.toLowerCase().includes("shadow") || token.name.toLowerCase().includes("radius"));

  return (
    <main className="app-shell preview-layout">
      <section className="preview-toolbar">
        <h1>Extraction preview</h1>
        <nav className="download-list">
          {job.files.tokens?.url ? <a href={job.files.tokens.url}>tokens.json</a> : null}
          {job.files.designMd?.url ? <a href={job.files.designMd.url}>DESIGN.md</a> : null}
          {job.files.brandGuide?.url ? <a href={job.files.brandGuide.url}>brand-guide.pdf</a> : null}
        </nav>
      </section>

      <section className="token-section">
        <h2>Colors</h2>
        <div className="color-grid">
          {colors.map((token) => (
            <article className="color-token" key={token.name}>
              <span className="swatch" style={{ background: String(token.value) }} />
              <strong>{token.name}</strong>
              <code>{String(token.value)}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="token-section">
        <h2>Typography</h2>
        <div className="token-list">
          {typography.map((token) => (
            <article key={token.name}>
              <strong>{token.name}</strong>
              <code>{JSON.stringify(token.value)}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="token-section">
        <h2>Spacing, radius, shadows</h2>
        <div className="token-list">
          {[...spacing, ...effects].map((token) => (
            <article key={token.name}>
              <strong>{token.name}</strong>
              <code>{JSON.stringify(token.value)}</code>
            </article>
          ))}
        </div>
      </section>

      {job.files.brandGuide?.url ? (
        <iframe className="brand-guide" title="Brand guide" src={job.files.brandGuide.url} />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 2: Wire preview route**

`frontend/src/App.tsx`:

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { Preview } from "./pages/Preview";
import { Status } from "./pages/Status";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/jobs/:jobId" element={<Status />} />
        <Route path="/jobs/:jobId/preview" element={<Preview />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Add preview styles**

Add to `frontend/src/styles.css`:

```css
.preview-layout {
  display: grid;
  gap: 24px;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.download-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.token-section {
  display: grid;
  gap: 12px;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.color-token,
.token-list article {
  border: 1px solid #deded8;
  border-radius: 8px;
  padding: 12px;
  background: #ffffff;
}

.swatch {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 2;
  border: 1px solid #d0d0ca;
  border-radius: 6px;
  margin-bottom: 8px;
}

.token-list {
  display: grid;
  gap: 8px;
}

.brand-guide {
  width: 100%;
  min-height: 720px;
  border: 1px solid #deded8;
  border-radius: 8px;
}
```

- [ ] **Step 4: Verify**

Run:

```bash
cd frontend
npm run build
```

Expected: build succeeds; preview route compiles and token categories render from a completed job's signed `tokens.json`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat: add rich token preview UI"
```
