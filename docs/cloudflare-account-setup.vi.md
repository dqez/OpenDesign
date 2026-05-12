# Hướng Dẫn Cài Đặt Tài Khoản Cloudflare Cho OpenDesign

Bản này được viết bằng tiếng Việt dựa trên `docs/cloudflare-account-setup.md`.
Mục tiêu là giúp người vận hành ở Việt Nam chuẩn bị một tài khoản Cloudflare mới trước khi deploy OpenDesign.

## Tổng Quan

Chạy hướng dẫn này một lần cho mỗi tài khoản hoặc mỗi môi trường Cloudflare.
Sau khi hoàn tất, bạn có thể deploy Worker API, frontend Pages và extractor container.

OpenDesign đang dùng:

- Cloudflare Worker: API, CORS, Queue consumer, scheduled cleanup và Workflow entrypoint.
- Cloudflare Pages: frontend tĩnh Vite React.
- Cloudflare D1: lưu job, order, payment, webhook event, email log và audit log.
- Cloudflare R2: lưu `tokens.json`, `DESIGN.md` và `brand-guide.pdf`.
- Cloudflare KV: cache IP usage và rate limit.
- Cloudflare Queues: job trích xuất bất đồng bộ.
- Cloudflare Workflows: polling trích xuất và email hoàn tất.
- Extractor container bên ngoài: dịch vụ Node/Docker chạy `dembrandt` và upload kết quả lên R2.

Lưu ý quan trọng: các ID trong `worker/wrangler.jsonc` là riêng cho từng tài khoản Cloudflare.
Nếu deploy sang tài khoản mới, hãy tạo D1/KV/R2 mới và thay toàn bộ ID cũ trước khi deploy.

## Điều Kiện Cần Có

- Node.js 20+.
- `npm` có trong PATH.
- Docker nếu bạn tự deploy extractor container.
- Tài khoản Cloudflare đã bật Workers, Pages, D1, KV, Queues, Workflows và R2.
- R2 S3 API token có quyền Object Read & Write trên bucket OpenDesign.
- Resend API key và sender domain đã verify cho `no-reply@opendesign.dqez.dev` hoặc sender khác đã duyệt.
- SePay webhook API key và thông tin tài khoản ngân hàng.
- Endpoint HTTPS công khai cho extractor, ví dụ `https://extractor.example.com`.

## Tài Liệu Chính Thức Nên Mở Kèm

- Wrangler commands: https://developers.cloudflare.com/workers/wrangler/commands/
- Wrangler configuration: https://developers.cloudflare.com/workers/wrangler/configuration/
- Worker secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- D1 Wrangler commands: https://developers.cloudflare.com/d1/wrangler-commands/
- KV namespace setup: https://developers.cloudflare.com/kv/get-started/
- R2 bucket creation: https://developers.cloudflare.com/r2/buckets/create-buckets/
- R2 S3 API tokens: https://developers.cloudflare.com/r2/api/tokens/
- R2 CORS: https://developers.cloudflare.com/r2/buckets/cors/
- Queues Wrangler commands: https://developers.cloudflare.com/queues/reference/wrangler-commands/
- Workflows guide: https://developers.cloudflare.com/workflows/get-started/guide/
- Pages direct upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Pages build environment variables: https://developers.cloudflare.com/pages/configuration/build-configuration/

## 1. Clone Repo Và Cài Package

PowerShell:

```powershell
git clone <repo-url> opendesign
cd opendesign

cd worker
npm ci

cd ..\frontend
npm ci

cd ..\container
npm ci

cd ..
```

Bash:

```bash
git clone <repo-url> opendesign
cd opendesign
(cd worker && npm ci)
(cd frontend && npm ci)
(cd container && npm ci)
```

## 2. Đăng Nhập Wrangler

Dùng đúng tài khoản Cloudflare mục tiêu, không dùng nhầm tài khoản cũ.

```powershell
cd worker
npx wrangler login
npx wrangler whoami
```

Nếu tài khoản đăng nhập có quyền trên nhiều account, Wrangler có thể hỏi bạn chọn account.
Với CI, nên dùng API token được giới hạn quyền và set biến môi trường:

```powershell
$env:CLOUDFLARE_API_TOKEN = "<cloudflare-api-token>"
$env:CLOUDFLARE_ACCOUNT_ID = "<cloudflare-account-id>"
```

Không commit API token hoặc account secret vào git.

## 3. Chọn Tên Resource

Tên production đang được khuyến nghị:

| Resource | Tên |
| --- | --- |
| Worker | `opendesign-api` |
| Pages project | `opendesign` |
| D1 production database | `opendesign-prod` |
| D1 preview database | `opendesign-preview` |
| KV binding | `KV` |
| R2 bucket | `opendesign-outputs` |
| Queue | `extraction-queue` |
| Workflow | `extraction-workflow` |

Queue và workflow ở trên đang khớp với `worker/wrangler.jsonc`.
Nếu bạn cần nhiều môi trường OpenDesign trong cùng một tài khoản, hãy đổi tên theo môi trường, ví dụ `opendesign-prod-extraction-queue` và `opendesign-prod-extraction-workflow`, sau đó cập nhật `worker/wrangler.jsonc`.

## 4. Tạo D1 Database

Chạy từ thư mục `worker/`:

```powershell
npx wrangler d1 create opendesign-prod
npx wrangler d1 create opendesign-preview
```

Copy database ID vừa tạo vào `worker/wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "opendesign-prod",
    "database_id": "<new-opendesign-prod-database-id>",
    "preview_database_id": "<new-opendesign-preview-database-id>",
    "migrations_dir": "migrations",
    "migrations_table": "d1_migrations"
  }
]
```

Apply migrations local và remote:

```powershell
npx wrangler d1 migrations apply opendesign-prod --local
npx wrangler d1 migrations apply opendesign-prod --remote
```

Kiểm tra bảng trên remote:

```powershell
npx wrangler d1 execute opendesign-prod --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Kết quả nên có các bảng `jobs`, `orders`, `payments`, `webhook_events`, `email_logs` và `audit_events`.

## 5. Tạo KV Namespace

Chạy từ `worker/`:

```powershell
npx wrangler kv namespace create KV
```

Copy ID trả về vào `worker/wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "KV",
    "id": "<new-kv-namespace-id>"
  }
]
```

Nếu cần namespace riêng cho preview, tạo thêm namespace riêng và thêm `preview_id`.

## 6. Tạo R2 Bucket

Chạy từ `worker/`:

```powershell
npx wrangler r2 bucket create opendesign-outputs
npx wrangler r2 bucket list
```

Apply CORS policy của repo:

```powershell
npx wrangler r2 bucket cors set opendesign-outputs --file r2-cors.json
npx wrangler r2 bucket cors list opendesign-outputs
```

`worker/r2-cors.json` nên cho phép:

- `https://opendesign.pages.dev`
- `http://localhost:5173`

Nếu Pages project hoặc custom domain khác, sửa `worker/r2-cors.json` rồi chạy lại lệnh set CORS.

## 7. Tạo R2 S3 API Credentials

Worker và extractor dùng API tương thích S3 của R2 để tạo presigned URL và upload file.

Trong Cloudflare Dashboard:

1. Vào R2 object storage.
2. Mở Manage API tokens.
3. Tạo Account hoặc User API token.
4. Chọn Object Read & Write.
5. Giới hạn scope vào `opendesign-outputs` nếu có thể.
6. Copy ngay hai giá trị:
   - Access Key ID -> `R2_ACCESS_KEY_ID`
   - Secret Access Key -> `R2_SECRET_ACCESS_KEY`

Ghi lại Cloudflare account ID để dùng cho `CF_ACCOUNT_ID`.

## 8. Tạo Queue

Chạy từ `worker/`:

```powershell
npx wrangler queues create extraction-queue
```

Config hiện tại bind cùng một Worker làm producer và consumer:

```jsonc
"queues": {
  "producers": [{ "queue": "extraction-queue", "binding": "EXTRACT_QUEUE" }],
  "consumers": [{ "queue": "extraction-queue", "max_batch_size": 1, "max_batch_timeout": 30 }]
}
```

Nếu đổi tên queue, cập nhật cả producer và consumer.

## 9. Workflows

Với cấu hình hiện tại, không cần lệnh tạo riêng.
Workflow binding được khai báo trong `worker/wrangler.jsonc` và sẽ được deploy cùng Worker:

```jsonc
"workflows": [
  {
    "binding": "EXTRACTION_WORKFLOW",
    "name": "extraction-workflow",
    "class_name": "ExtractionWorkflow"
  }
]
```

Sau khi đổi binding, generate lại Worker types:

```powershell
npm run types
```

## 10. Tạo Pages Project

Bạn có thể tạo Pages project trước hoặc tạo trong lúc deploy.

Interactive:

```powershell
npx wrangler pages project create
```

Dùng project name `opendesign` và production branch `main`, trừ khi team của bạn dùng branch production khác.

Non-interactive nếu Wrangler version của bạn hỗ trợ:

```powershell
npx wrangler pages project create opendesign --production-branch main
```

Site mặc định sẽ có URL `https://opendesign.pages.dev`, trừ khi tên này đã bị dùng hoặc bạn gán custom domain.

## 11. Worker Vars Và Secrets

Plain vars đang nằm trong `worker/wrangler.jsonc`:

```jsonc
"vars": {
  "DEV_ORIGIN": "http://localhost:5173",
  "DEV_ORIGINS": "http://localhost:5173,http://127.0.0.1:5173",
  "FRONTEND_ORIGIN": "https://opendesign.pages.dev",
  "R2_BUCKET_NAME": "opendesign-outputs",
  "EXTRACTOR_URL": "https://extractor.dqez.dev",
  "SEPAY_BANK_ACCOUNT": "101877455638",
  "SEPAY_BANK_NAME": "VIETINBANK",
  "SEPAY_BANK_ACCOUNT_NAME": "TRAN DINH QUY"
}
```

Sửa các giá trị này trước khi deploy nếu Pages URL, extractor URL hoặc thông tin ngân hàng khác.

Set Worker secrets từ `worker/`:

```powershell
npx wrangler secret put IP_HASH_SALT
npx wrangler secret put SEPAY_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EXTRACTOR_API_KEY
npx wrangler secret put CF_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

Giá trị khuyến nghị:

| Secret | Giá trị cần có |
| --- | --- |
| `IP_HASH_SALT` | Chuỗi dài ngẫu nhiên để hash IP client |
| `SEPAY_API_KEY` | API key dùng chung, SePay webhook gửi qua `Authorization: Apikey ...` |
| `RESEND_API_KEY` | Resend API key |
| `EXTRACTOR_API_KEY` | Bearer token dùng chung giữa Worker và extractor |
| `CF_ACCOUNT_ID` | Cloudflare account ID cho R2 S3 endpoint |
| `R2_ACCESS_KEY_ID` | R2 S3 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 S3 Secret Access Key |

## 12. Secret Cho Local Development

Để chạy Worker local, tạo `worker/.dev.vars`. Không commit file này.

```dotenv
IP_HASH_SALT="replace-with-random-string"
SEPAY_API_KEY="replace-with-sepay-webhook-key"
RESEND_API_KEY="replace-with-resend-key"
EXTRACTOR_API_KEY="replace-with-shared-extractor-key"
CF_ACCOUNT_ID="replace-with-cloudflare-account-id"
R2_ACCESS_KEY_ID="replace-with-r2-access-key-id"
R2_SECRET_ACCESS_KEY="replace-with-r2-secret-access-key"
```

Frontend local:

```powershell
cd frontend
$env:VITE_API_BASE = "http://127.0.0.1:8787"
npm run dev
```

Frontend production build:

```powershell
$env:VITE_API_BASE = "https://opendesign-api.<workers-subdomain>.workers.dev"
```

## 13. Môi Trường Extractor

Extractor container cần các biến môi trường:

```dotenv
PORT=8080
EXTRACTOR_API_KEY="same-value-as-worker-secret"
CF_ACCOUNT_ID="cloudflare-account-id"
R2_ACCESS_KEY_ID="r2-access-key-id"
R2_SECRET_ACCESS_KEY="r2-secret-access-key"
R2_BUCKET_NAME="opendesign-outputs"
```

Dùng cùng một `EXTRACTOR_API_KEY` trong Worker và container.

## Checklist Cài Đặt

- [ ] `npx wrangler whoami` hiện đúng tài khoản mục tiêu.
- [ ] `worker/wrangler.jsonc` có D1 database ID mới.
- [ ] `worker/wrangler.jsonc` có KV namespace ID mới.
- [ ] R2 bucket `opendesign-outputs` đã tồn tại.
- [ ] R2 CORS policy đã được apply.
- [ ] Queue `extraction-queue` đã tồn tại hoặc config đã dùng tên queue mới.
- [ ] Worker secrets đã được set.
- [ ] Extractor HTTPS endpoint đã tồn tại và khớp `EXTRACTOR_URL`.
- [ ] Pages project đã tồn tại hoặc sẽ được tạo khi deploy.
- [ ] Resend sender domain đã verify.
- [ ] SePay webhook có thể gửi `Authorization: Apikey <SEPAY_API_KEY>`.
