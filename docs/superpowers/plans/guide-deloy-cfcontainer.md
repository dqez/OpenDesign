• Bạn làm theo thứ tự này trong worktree:

cd E:\opendesign-codex\.worktrees\planb-backend

Tôi dùng Context7 cho Cloudflare Workers/Wrangler docs: các lệnh hiện hành gồm wrangler types, wrangler d1 create, wrangler
d1 migrations apply --remote, wrangler r2 bucket create, wrangler kv namespace create, wrangler pages deploy, wrangler
secret put, và wrangler deploy.

1. Đăng nhập Cloudflare

cd worker
npx wrangler --version
npx wrangler login
npx wrangler whoami

Ghi lại Account ID từ whoami. Lát nữa dùng cho secret CF_ACCOUNT_ID.

2. Tạo tài nguyên Cloudflare thật

Chạy trong worker:

npx wrangler d1 create 2design-prod
npx wrangler d1 create 2design-preview
npx wrangler kv namespace create 2design-kv
npx wrangler r2 bucket create 2design-outputs
npx wrangler queues create extraction-queue

Sau mỗi lệnh, Cloudflare sẽ in ra ID/config. Cần copy:

- D1 prod database_id
- D1 preview database_id
- KV namespace id

Queue và R2 dùng theo tên nên không cần ID trong config hiện tại.

3. Sửa worker/wrangler.jsonc

Mở:

notepad .\wrangler.jsonc

Thay các placeholder:

"kv_namespaces": [
{ "binding": "KV", "id": "<KV_NAMESPACE_ID_THAT>" }
],
"d1_databases": [
{
"binding": "DB",
"database_name": "2design-prod",
"database_id": "<D1_PROD_DATABASE_ID>",
"preview_database_id": "<D1_PREVIEW_DATABASE_ID>",
"migrations_dir": "migrations",
"migrations_table": "d1_migrations"
}
]

Điền thông tin ngân hàng thật cho SePay:

"SEPAY_BANK_ACCOUNT": "so_tai_khoan",
"SEPAY_BANK_NAME": "ten_ngan_hang_theo_SePay",
"SEPAY_BANK_ACCOUNT_NAME": "TEN CHU TAI KHOAN"

Nếu chưa có custom domain Pages, giữ tạm:

"FRONTEND_ORIGIN": "https://2design.pages.dev"

Nếu Pages project tên khác, lát nữa quay lại sửa đúng origin.

4. Tạo R2 API token

Vào Cloudflare Dashboard:

R2 → Manage R2 API Tokens → Create API token

Chọn bucket 2design-outputs, quyền tối thiểu nên có Object Read. Nếu muốn đơn giản giai đoạn staging, dùng Read/Write cho
bucket này.

Ghi lại:

- Access Key ID
- Secret Access Key

5. Set secrets cho Worker

Chạy trong worker:

npx wrangler secret put IP_HASH_SALT
npx wrangler secret put SEPAY_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put CF_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY

Giá trị:

- IP_HASH_SALT: chuỗi random dài, ví dụ tạo bằng password manager.
- SEPAY_API_KEY: API key cấu hình trong SePay webhook.
- RESEND_API_KEY: key thật từ Resend.
- CF_ACCOUNT_ID: Account ID từ npx wrangler whoami.
- R2_ACCESS_KEY_ID: từ R2 API token.
- R2_SECRET_ACCESS_KEY: từ R2 API token.

Kiểm tra secrets đã có:

npx wrangler secret list

6. Generate types và validate local config

npx wrangler types
npm run typecheck

Nếu wrangler types làm thay đổi worker-configuration.d.ts, đó là bình thường vì config đã đổi sang resource thật.

7. Apply D1 migration lên remote

npx wrangler d1 migrations apply 2design-prod --remote

Kiểm tra bảng đã có:

npx wrangler d1 execute 2design-prod --remote --command "SELECT name FROM sqlite_master WHERE type='table';"

Phải thấy các bảng kiểu jobs, orders, payments, webhook_events, email_logs, audit_events.

8. Deploy Worker + Workflow + Container

Đảm bảo Docker Desktop đang chạy, vì project có Cloudflare Container từ container/Dockerfile.

npx wrangler deploy

Sau deploy, ghi lại Worker URL, thường dạng:

https://2design-api.<subdomain>.workers.dev

Test health:

Invoke-RestMethod "https://2design-api.<subdomain>.workers.dev/api/health"

9. Deploy frontend lên Cloudflare Pages

Sang frontend:

cd ..\frontend
$env:VITE_API_BASE="https://2design-api.<subdomain>.workers.dev"
npm run build
npx wrangler pages project create 2design
npx wrangler pages deploy dist --project-name 2design --branch production

Nếu project 2design đã tồn tại, lệnh pages project create có thể báo đã có; bỏ qua và chạy deploy.

Sau deploy, bạn sẽ có URL Pages, ví dụ:

https://2design.pages.dev

Nếu URL thực tế khác, quay lại worker/wrangler.jsonc, sửa FRONTEND_ORIGIN, rồi deploy Worker lại:

cd ..\worker
npx wrangler deploy

10. Cấu hình SePay webhook

Trong SePay Dashboard:

- Event: Có tiền vào
- URL:

  https://2design-api.<subdomain>.workers.dev/api/sepay/webhook

- Auth: API Key
- API key: đúng giá trị bạn đã set vào SEPAY_API_KEY
- Bỏ qua nếu không có code: Có

Nội dung chuyển khoản phải chứa order code dạng 2D-XXXXXX.

11. Smoke test production thật

Test health:

$api="https://2design-api.<subdomain>.workers.dev"
  Invoke-RestMethod "$api/api/health"

Test lượt miễn phí đầu tiên:

$body = @{ url="https://neon.com"; email="you@example.com" } | ConvertTo-Json

Invoke-WebRequest `    -Method Post`
-Uri "$api/api/extract" `    -ContentType "application/json"`
-Body $body

Kỳ vọng: HTTP 202, có jobId.

Poll job:

$jobId="job_xxx"
  Invoke-RestMethod "$api/api/jobs/$jobId"

Theo dõi logs:

cd E:\opendesign-codex\.worktrees\planb-backend\worker
npx wrangler tail 2design-api

Kiểm tra D1 remote:

npx wrangler d1 execute 2design-prod --remote --command "SELECT job_id, url, email, status, paid, order_code, r2_keys,
failure_reason FROM jobs ORDER BY created_at DESC LIMIT 5;"

npx wrangler d1 execute 2design-prod --remote --command "SELECT job_id, event_type, metadata, created_at FROM audit_events
ORDER BY created_at DESC LIMIT 20;"

Test lượt thứ hai cùng IP:

Invoke-WebRequest `    -Method Post`
-Uri "$api/api/extract" `    -ContentType "application/json"`
-Body $body

Kỳ vọng: HTTP 402, có orderCode, amount = 25000, qrUrl.

npx wrangler d1 execute 2design-prod --remote --command "SELECT order_code, status, paid_at FROM orders ORDER BY created_at
DESC LIMIT 5;"

webhook_events ORDER BY received_at DESC LIMIT 5;"

12. Điều kiện để coi deploy đúng workflow

- Frontend Pages gọi được Worker.
- First extraction trả 202, tạo job D1, đi qua Queue/Workflow.
- Container chạy dembrandt và upload đủ 3 file lên R2.
- GET /api/jobs/:jobId trả completed với signed URLs mở được.
- wrangler tail không có lỗi runtime nghiêm trọng.

Nguồn Context7 đã dùng: Cloudflare Workers docs cho Wrangler deploy/types, KV namespace, D1 create/migrations, R2 bucket,
Pages deploy và binding config.
