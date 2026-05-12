# Phase 0 Repo Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the project skeleton needed by the backend PRD without implementing business behavior yet.

**Architecture:** The repository is split into `worker`, `container`, and `frontend` packages. Each package owns its runtime, tests, and build scripts so later phases can verify each subsystem independently.

**Tech Stack:** TypeScript, Wrangler, Hono, `@cloudflare/containers`, Vitest, Vite, React, Node.js 20, Docker.

---

## Task 0.1: Worker Package Skeleton

**Files:**

- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `worker/vitest.config.ts`
- Create: `worker/src/index.ts`
- Create: `worker/src/app.ts`
- Create: `worker/src/containers/dembrandt.ts`
- Create: `worker/src/types.ts`
- Create: `worker/src/routes/health.ts`
- Create: `worker/test/health.test.ts`

- [ ] **Step 1: Create `worker/package.json`**

```json
{
  "name": "opendesign-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "types": "wrangler types",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.0.0",
    "@aws-sdk/s3-request-presigner": "^3.0.0",
    "@cloudflare/containers": "^0.3.3",
    "hono": "^4.0.0",
    "nanoid": "^5.0.0",
    "resend": "^4.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^3.0.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create TypeScript and Vitest config**

`worker/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["@cloudflare/workers-types", "vitest/globals"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "test", "vitest.config.ts"]
}
```

`worker/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 3: Create health route and app**

`worker/src/types.ts`:

```ts
import type { DurableObjectNamespace } from "@cloudflare/workers-types";

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
  DEMBRANDT_CONTAINER: DurableObjectNamespace;
  IP_HASH_SALT: string;
  SEPAY_API_KEY: string;
  RESEND_API_KEY: string;
  CF_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  FRONTEND_ORIGIN: string;
  DEV_ORIGIN: string;
  SEPAY_BANK_ACCOUNT: string;
  SEPAY_BANK_NAME: string;
  SEPAY_BANK_ACCOUNT_NAME: string;
};

export type AppEnv = { Bindings: Env };
```

`worker/src/routes/health.ts`:

```ts
import { Hono } from "hono";
import type { Env } from "../types";

export const healthRoute = new Hono<{ Bindings: Env }>().get("/health", (c) => {
  return c.json({ ok: true, service: "opendesign-api" });
});
```

`worker/src/index.ts`:

```ts
import { ContainerProxy } from "@cloudflare/containers";
import { DembrandtContainer } from "./containers/dembrandt";
import app from "./app";

export { ContainerProxy, DembrandtContainer };

export default {
  fetch: app.fetch,
};
```

`worker/src/app.ts`:

```ts
import { Hono } from "hono";
import { healthRoute } from "./routes/health";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>().basePath("/api");
app.route("/", healthRoute);

export default app;
```

`worker/src/containers/dembrandt.ts`:

```ts
import { Container } from "@cloudflare/containers";

export class DembrandtContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
  enableInternet = true;
  entrypoint = ["npm", "run", "start"];

  override onStop(event: { exitCode?: number; reason?: string }) {
    console.log("dembrandt_container_stopped", event);
  }

  override onError(error: unknown) {
    console.error("dembrandt_container_error", error);
    throw error;
  }
}
```

- [ ] **Step 4: Add health test**

`worker/test/health.test.ts`:

```ts
import app from "../src/index";

it("returns health status", async () => {
  const response = await app.request("/api/health");
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    ok: true,
    service: "opendesign-api",
  });
});
```

- [ ] **Step 5: Verify worker skeleton**

Run:

```bash
cd worker
npm install
npm run types
npm test
npm run typecheck
```

Expected: Wrangler writes Worker binding types, health test passes, and TypeScript exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add worker
git commit -m "chore: scaffold worker package"
```

## Task 0.2: Container Package Skeleton

**Files:**

- Create: `container/package.json`
- Create: `container/tsconfig.json`
- Create: `container/src/health.ts`
- Create: `container/src/server.ts`
- Create: `container/Dockerfile`

- [ ] **Step 1: Create package and TypeScript config**

`container/package.json`:

```json
{
  "name": "opendesign-container",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx src/server.ts",
    "start": "node dist/server.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "build:image": "docker build -t opendesign-dembrandt ."
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.0.0",
    "dembrandt": "^0.11.0",
    "hono": "^4.0.0",
    "@hono/node-server": "^1.0.0",
    "playwright": "^1.0.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^3.0.0"
  }
}
```

`container/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 2: Create health server**

`container/src/health.ts`:

```ts
export function healthPayload() {
  return { ok: true, service: "opendesign-dembrandt-container" };
}
```

`container/src/server.ts`:

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { healthPayload } from "./health";

const app = new Hono();

app.get("/health", (c) => c.json(healthPayload()));

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8080) });
```

- [ ] **Step 3: Create Dockerfile**

`container/Dockerfile`:

```dockerfile
FROM node:20-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
RUN npx playwright install --with-deps chromium
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV PORT=8080
EXPOSE 8080
CMD ["npm", "run", "start"]
```

- [ ] **Step 4: Verify container skeleton**

Run:

```bash
cd container
npm install
npm run build
npm run typecheck
npm run build:image
```

Expected: TypeScript exits with code 0, `dist/server.js` exists, and Docker image builds.

- [ ] **Step 5: Commit**

```bash
git add container
git commit -m "chore: scaffold extraction container"
```

## Task 0.3: Frontend Package Skeleton

**Files:**

- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/styles.css`

- [ ] **Step 1: Create Vite package**

`frontend/package.json`:

```json
{
  "name": "opendesign-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^7.0.0",
    "typescript": "^5.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "vitest": "^3.0.0"
  }
}
```

`frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "vite.config.ts"]
}
```

`frontend/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 2: Create minimal app**

`frontend/index.html`:

```html
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OpenDesign</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`frontend/src/App.tsx`:

```tsx
export function App() {
  return <main className="app-shell">OpenDesign</main>;
}
```

`frontend/src/styles.css`:

```css
:root {
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  color: #151515;
  background: #f7f7f5;
}

body {
  margin: 0;
}

.app-shell {
  min-height: 100vh;
  padding: 24px;
}
```

- [ ] **Step 3: Verify frontend skeleton**

Run:

```bash
cd frontend
npm install
npm run build
```

Expected: Vite build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend
git commit -m "chore: scaffold frontend package"
```
