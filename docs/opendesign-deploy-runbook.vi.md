# Runbook Deploy OpenDesign

Bản này được viết bằng tiếng Việt dựa trên `docs/opendesign-deploy-runbook.md`.
Dùng runbook này sau khi tài khoản Cloudflare đã được tạo resource theo `docs/cloudflare-account-setup.vi.md`.

## Tổng Quan

Runbook này hướng dẫn deploy OpenDesign cho production mới hoặc deploy lại sau khi có thay đổi code.

Doc nên đọc trước:

- `docs/cloudflare-account-setup.vi.md`
- `docs/cloudflare-account-setup.md`
- `worker/wrangler.example.jsonc`
- `worker/r2-cors.json`

## Thứ Tự Deploy

1. Kiểm tra package local.
2. Deploy hoặc update extractor container.
3. Apply D1 migrations.
4. Deploy Worker API.
5. Deploy Pages frontend.
6. Cấu hình SePay webhook.
7. Chạy smoke checks.

## 1. Preflight

Chạy từ repo root:

```powershell
git status --short
node --version
npm --version
```

Nếu cần cài dependencies:

```powershell
cd worker
npm ci

cd ..\container
npm ci

cd ..\frontend
npm ci

cd ..
```

Xác nhận Wrangler đang trỏ vào đúng tài khoản Cloudflare:

```powershell
cd worker
npx wrangler whoami
cd ..
```

Nếu kết quả là tài khoản sai, dừng lại và chạy `npx wrangler login` hoặc set đúng `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`.

Trước khi deploy lên tài khoản mới, bảo đảm `worker/wrangler.jsonc` tồn tại dưới dạng bản copy local từ file example và đã có các ID/giá trị tạo trong hướng dẫn setup account:

```powershell
cd worker
if (-not (Test-Path .\wrangler.jsonc)) { Copy-Item .\wrangler.example.jsonc .\wrangler.jsonc }
cd ..
```

Không copy ID từ một `worker/wrangler.jsonc` thuộc tài khoản Cloudflare khác.

## 2. Kiểm Tra Local

Chạy bộ verify đầy đủ:

```powershell
cd worker
npm run types
npm test
npm run typecheck
npx wrangler d1 migrations apply opendesign-prod --local
cd ..

cd container
npm test
npm run typecheck
npm run build
cd ..

cd frontend
npm test
npm run build
cd ..
```

Kết quả mong đợi:

- Worker tests pass.
- Worker typecheck pass.
- Local D1 migrations apply thành công.
- Container tests/typecheck/build pass.
- Frontend tests/build pass.

## 3. Deploy Extractor Container

Worker gọi `EXTRACTOR_URL` để trích xuất.
Container phải truy cập được qua HTTPS và phải dùng cùng `EXTRACTOR_API_KEY` với Worker.

### Build Image

```powershell
cd container
docker build -t opendesign-dembrandt:vps .
```

### Chạy Local Để Kiểm Tra Nhanh

Tạo env file nằm ngoài git, ví dụ `E:\secrets\opendesign-extractor.env`:

```dotenv
PORT=8080
EXTRACTOR_API_KEY=replace-with-shared-secret
CF_ACCOUNT_ID=replace-with-cloudflare-account-id
R2_ACCESS_KEY_ID=replace-with-r2-access-key-id
R2_SECRET_ACCESS_KEY=replace-with-r2-secret-access-key
R2_BUCKET_NAME=opendesign-outputs
```

Chạy container:

```powershell
docker rm -f opendesign-extractor
docker run -d --name opendesign-extractor `
  -p 8080:8080 `
  --env-file E:\secrets\opendesign-extractor.env `
  opendesign-dembrandt:vps
```

Kiểm tra health:

```powershell
Invoke-RestMethod "http://127.0.0.1:8080/health"
```

Kết quả mong đợi:

```json
{
  "ok": true,
  "service": "opendesign-dembrandt-container"
}
```

### Deploy Lên VPS

Ví dụ flow trên Linux VPS:

```bash
sudo mkdir -p /opt/opendesign/container
sudo mkdir -p /opt/opendesign/secrets
```

Copy thư mục `container/` lên `/opt/opendesign/container`, sau đó chạy trên VPS:

```bash
cd /opt/opendesign/container
npm ci
docker build -t opendesign-dembrandt:vps .
```

Tạo `/opt/opendesign/secrets/extractor.env`:

```dotenv
PORT=8080
EXTRACTOR_API_KEY=replace-with-shared-secret
CF_ACCOUNT_ID=replace-with-cloudflare-account-id
R2_ACCESS_KEY_ID=replace-with-r2-access-key-id
R2_SECRET_ACCESS_KEY=replace-with-r2-secret-access-key
R2_BUCKET_NAME=opendesign-outputs
```

Bảo vệ file secret:

```bash
chmod 600 /opt/opendesign/secrets/extractor.env
```

Run container:

```bash
docker rm -f opendesign-extractor || true
docker run -d --name opendesign-extractor \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file /opt/opendesign/secrets/extractor.env \
  opendesign-dembrandt:vps
```

Expose container qua HTTPS bằng một trong các cách:

- Cloudflare Tunnel, ví dụ `https://extractor.example.com`.
- Reverse proxy có TLS, ví dụ Caddy hoặc Nginx.
- Managed container host có HTTPS.

Sau khi có public URL, cập nhật `EXTRACTOR_URL` trong file local `worker/wrangler.jsonc` được copy từ `worker/wrangler.example.jsonc`:

```jsonc
"EXTRACTOR_URL": "https://extractor.example.com"
```

Sau đó deploy lại Worker.

## 4. Apply D1 Migrations

Chạy từ `worker/`:

```powershell
cd worker
npx wrangler d1 migrations list opendesign-prod --remote
npx wrangler d1 migrations apply opendesign-prod --remote
```

Kiểm tra bảng:

```powershell
npx wrangler d1 execute opendesign-prod --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Nếu migrations fail, không deploy Worker cho đến khi schema được sửa.

## 5. Deploy Worker API

Chạy từ `worker/`:

```powershell
npm run types
npm run typecheck
npm test
npm run deploy
```

Output mong đợi có URL `workers.dev`, thường có dạng:

```text
https://opendesign-api.<workers-subdomain>.workers.dev
```

Lưu URL này làm `API_BASE`.

Kiểm tra health:

```powershell
$api = "https://opendesign-api.<workers-subdomain>.workers.dev"
Invoke-RestMethod "$api/api/health"
```

Kết quả mong đợi:

```json
{
  "ok": true,
  "service": "opendesign-api"
}
```

Kiểm tra logs khi cần:

```powershell
npx wrangler tail opendesign-api
```

## 6. Deploy Frontend Lên Pages

Chạy từ `frontend/`, build với Worker URL vừa deploy.

```powershell
cd ..\frontend
$env:VITE_API_BASE = "https://opendesign-api.<workers-subdomain>.workers.dev"
npm test
npm run build
```

Tạo Pages project nếu chưa có:

```powershell
npx wrangler pages project create opendesign
```

Deploy:

```powershell
npx wrangler pages deploy dist --project-name opendesign --branch main
```

URL mong đợi:

```text
https://opendesign.pages.dev
```

Nếu Pages URL cuối cùng khác, cập nhật tất cả nơi sau:

- file local `worker/wrangler.jsonc` -> `vars.FRONTEND_ORIGIN`
- `worker/r2-cors.json`
- Chạy lại `npx wrangler r2 bucket cors set opendesign-outputs --file r2-cors.json`
- Chạy lại `npm run deploy` trong `worker`

## 7. Cấu Hình SePay Webhook

Dùng webhook URL:

```text
https://opendesign-api.<workers-subdomain>.workers.dev/api/sepay/webhook
```

Worker yêu cầu header:

```text
Authorization: Apikey <SEPAY_API_KEY>
```

Payload phải có order code trong `code` hoặc `content`.
Order OpenDesign mới dùng dạng:

```text
OD-XXXXXX
```

Legacy `2D-XXXXXX` vẫn được chấp nhận cho các pending payment tạo trước khi rebrand.

Nếu SePay không gửi trực tiếp được Authorization header theo yêu cầu, đặt trusted adapter/proxy trước Worker hoặc sửa `worker/src/middleware/sepay-auth.ts` một cách có chủ đích và test lại.

## 8. Smoke Tests Production

Set URLs:

```powershell
$api = "https://opendesign-api.<workers-subdomain>.workers.dev"
$site = "https://opendesign.pages.dev"
```

API health:

```powershell
Invoke-RestMethod "$api/api/health"
```

Design catalog:

```powershell
Invoke-WebRequest "$api/api/designs" -UseBasicParsing
```

Frontend:

```powershell
Invoke-WebRequest "$site" -UseBasicParsing
```

Submit một first free extraction:

```powershell
$body = @{
  url = "https://neon.com"
  email = "tester@example.com"
} | ConvertTo-Json

Invoke-RestMethod "$api/api/extract" -Method Post -ContentType "application/json" -Body $body
```

Với IP mới, kết quả mong đợi:

```json
{
  "jobId": "job_...",
  "status": "queued",
  "pollUrl": "/api/jobs/job_..."
}
```

Poll job vừa trả về:

```powershell
Invoke-RestMethod "$api/api/jobs/<job-id>"
```

Trạng thái mong đợi:

- `queued`
- `processing`
- `completed` kèm signed artifact URLs, hoặc `failed` kèm `failureReason` rõ ràng

## 9. Kiểm Tra R2

Sau khi job completed, list object trong bucket:

```powershell
npx wrangler r2 object list opendesign-outputs
```

Key mong đợi có dạng:

```text
neon.com/job_<id>/tokens.json
neon.com/job_<id>/DESIGN.md
neon.com/job_<id>/brand-guide.pdf
```

Nếu browser download fail nhưng object listing vẫn đúng, kiểm tra lại R2 CORS:

```powershell
cd worker
npx wrangler r2 bucket cors list opendesign-outputs
```

## 10. Kiểm Tra D1

Xem jobs gần đây:

```powershell
cd worker
npx wrangler d1 execute opendesign-prod --remote --command "SELECT job_id, url, email, status, paid, order_code, failure_reason, created_at FROM jobs ORDER BY created_at DESC LIMIT 10;"
```

Xem orders gần đây:

```powershell
npx wrangler d1 execute opendesign-prod --remote --command "SELECT order_code, status, amount, paid_at, expires_at FROM orders ORDER BY created_at DESC LIMIT 10;"
```

Xem webhook events gần đây:

```powershell
npx wrangler d1 execute opendesign-prod --remote --command "SELECT provider_event_id, order_code, status, processed_at FROM webhook_events ORDER BY received_at DESC LIMIT 10;"
```

## 11. Lỗi Thường Gặp

### Worker deploy báo D1 database not found

Nguyên nhân: `database_id` sai hoặc Wrangler đang dùng sai Cloudflare account.

Cách sửa:

```powershell
npx wrangler d1 list
```

Copy đúng ID vào file local `worker/wrangler.jsonc` được tạo từ `worker/wrangler.example.jsonc`, sau đó chạy:

```powershell
npm run types
npm run deploy
```

### R2 upload hoặc presigned URL fail

Kiểm tra:

- `CF_ACCOUNT_ID` khớp với account sở hữu `opendesign-outputs`.
- R2 S3 token có Object Read & Write cho bucket.
- `R2_BUCKET_NAME` là `opendesign-outputs`.
- Extractor và Worker dùng cùng R2 credentials.

### Extract jobs fail với `extractor_start_failed`

Kiểm tra:

- `EXTRACTOR_URL` là public HTTPS và truy cập được.
- Worker secret `EXTRACTOR_API_KEY` khớp với extractor env.
- Extractor container đang chạy.
- VPS firewall cho phép port đã expose hoặc tunnel đang active.

### Browser bị CORS khi download

Kiểm tra:

- `worker/r2-cors.json` có đúng Pages origin thực tế.
- R2 CORS policy đã được apply bằng `r2 bucket cors set`.
- Request từ browser có `Origin` header.

### SePay webhook trả 401

Kiểm tra:

- Header đúng chính xác `Authorization: Apikey <SEPAY_API_KEY>`.
- Worker đã deploy có secret `SEPAY_API_KEY`.

### Frontend gọi sai API

Nguyên nhân: `VITE_API_BASE` không được set lúc build.

Cách sửa:

```powershell
cd frontend
$env:VITE_API_BASE = "https://opendesign-api.<workers-subdomain>.workers.dev"
npm run build
npx wrangler pages deploy dist --project-name opendesign --branch main
```

## 12. Rollback

Rollback Worker:

- Dùng Cloudflare dashboard Deployments để rollback về Worker version trước.
- Hoặc redeploy commit trước đó:

```powershell
git checkout <previous-good-commit>
cd worker
npm ci
npm run deploy
```

Rollback Pages:

- Dùng Cloudflare Pages deployments UI và promote deployment trước.
- Hoặc redeploy `frontend/dist` của commit trước.

Rollback extractor:

```bash
docker rm -f opendesign-extractor
docker run -d --name opendesign-extractor \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file /opt/opendesign/secrets/extractor.env \
  opendesign-dembrandt:<previous-tag>
```

Không rollback D1 migrations nếu chưa có data rollback plan đã test.

## Checklist Deploy Cuối

- [ ] Extractor `/health` trả về `opendesign-dembrandt-container`.
- [ ] D1 remote migrations đã apply.
- [ ] Worker `npm test` và `npm run typecheck` pass trước khi deploy.
- [ ] Worker `/api/health` trả về `opendesign-api`.
- [ ] Pages build dùng production `VITE_API_BASE`.
- [ ] Pages URL được Worker CORS và R2 CORS cho phép.
- [ ] SePay webhook URL và Authorization header đã được cấu hình.
- [ ] Test extraction có thể completed và tạo R2 objects.
- [ ] Email hoàn tất được nhận và có link `tokens.json`, `DESIGN.md`, `brand-guide.pdf`.
