# Đề 29 — kiểm tra triển khai CookShare

**Cập nhật sau đợt audit:** đã đồng bộ dữ liệu và chuyển Docker :8080 sang database mới, 141 món/17 tài khoản, có browser/SQL/upload checks. Xem [DATA_SYNC](DATA_SYNC.md) và [kết quả production](report-evidence/data-sync-production.json). Bảng audit bên dưới giữ kết quả tại thời điểm kiểm tra trước đồng bộ; không dùng con số cũ để mô tả bản :8080 hiện tại. phpMyAdmin còn lỗi image snapshot; logging Docker/Loki chưa được xác minh thành công.

Ngày thực chạy: **22/10/2026, Asia/Saigon**. Giữ React/TypeScript, Express, MySQL, Docker Compose, Nginx, Prometheus, Grafana, Loki và Alloy. Không chỉnh giao diện trong lượt kiểm tra này.

**Đọc trạng thái đúng phạm vi:** PASS chỉ áp dụng môi trường ghi trong ô bằng chứng. Native Windows không phải Docker. FAIL là bước đã chạy và thất bại; NOT VERIFIED là chưa có kiểm chứng đầy đủ. Kết quả CI ngày 15/10 trong `CI_EVIDENCE.md` là lịch sử, không chứng nhận các thay đổi chưa commit hiện tại.

## 15 mục đánh giá

| STT | Mục báo cáo | Trạng thái | Bằng chứng và giới hạn |
|---|---|---|---|
| 01 | Mã nguồn và GitHub | NOT VERIFIED | Có repository và ít nhất 3 commit có ý nghĩa; HEAD `ea05ce8`. Các sửa đăng ký/đăng xuất, catalog và lượt DevOps này còn ở working tree, chưa đẩy GitHub. Không đánh dấu repository remote là bản cuối. |
| 02 | Build, dependencies, Dockerfiles | PASS — native build | Backend `tsc` và frontend `tsc --noEmit && vite build` đã chạy thành công. Hai báo cáo npm audit gồm cả dev dependencies đều 0 advisory. Dockerfiles multi-stage có sẵn; **build image chưa hoàn tất**, nằm ở mục 03. [audit backend](report-evidence/backend-dependencies.json), [audit frontend](report-evidence/frontend-dependencies.json). |
| 03 | Compose, biến môi trường, volumes, healthchecks và chạy container | FAIL | Đã tạo `.env` ngẫu nhiên, chạy Compose config thành công. `up -d --build` thất bại khi pull: `read-only file system` trong Docker Desktop storage; ổ C chỉ còn khoảng 0,5 GiB lúc kiểm tra. Không có stack CookShare chạy. [blocker](report-evidence/docker-blocker.json), [PowerShell](report-evidence/powershell-checks.json). Không xóa volume hoặc reset Docker. |
| 04 | Frontend, responsive, USER/ADMIN | PASS — native Windows/Chrome | 5 bài UI qua: 360–1440px theo từng bài test, keyboard dialog, axe-core, tìm kiếm/lọc/phân trang, upload, hồ sơ, công thức và dashboard. [JUnit](report-evidence/browser-tests.xml), [trang chủ](report-evidence/home-desktop.png), [mobile](report-evidence/home-mobile.png), [quản trị](report-evidence/ui-admin-table-1440.png). Không kiểm chứng thiết bị thật/Safari/Firefox. |
| 05 | Express REST, xác thực, phân quyền, CRUD thật | PASS — native + DB test riêng | **28/28** backend tests với MySQL thật, gồm owner/admin, transaction, uniqueness, upload, tương tác, đổi mật khẩu/logout và JSON 429. Browser tạo/sửa/xóa công thức, danh mục, bình luận thật. [JSON tests](report-evidence/backend-tests.json). |
| 06 | MySQL schema, migrations, seed và SQL | PASS — MySQL Windows 8.0.46 | Query trực tiếp ledger/tables và số lượng: **141 món, 6 danh mục**. Bộ test dùng `cookshare_test`, không xóa DB ứng dụng. [SQL snapshot](report-evidence/local-runtime.json). MySQL 8.4 trong Docker chưa chạy ở lượt này. |
| 07 | phpMyAdmin đăng nhập, xem bảng, truy vấn SQL | NOT VERIFIED | Có profile tools, PMA_HOST=db, cổng loopback 8081. Image chưa pull xong nên chưa đăng nhập hoặc query bằng UI. HTTP PASS cũ trong CI không thay cho bằng chứng login/query hiện tại. |
| 08 | Nginx reverse proxy, truy cập web, security headers | NOT VERIFIED | Config có proxy API/uploads/health, CSP/nosniff/frame-deny/referrer policy, chặn `/metrics`; thêm healthcheck. Container chưa build/start nên chưa chạy `nginx -t` hoặc kiểm tra headers qua 8080. Header từ Express tại 3000 không được dùng làm bằng chứng Nginx. |
| 09 | Prometheus Targets và API metrics | NOT VERIFIED — đủ stack | Native scrape **API UP**, counter có sample thật. Target MySQL DOWN và không có target cAdvisor trong cấu hình native. [Targets thật](report-evidence/prometheus-targets-native.png), [metrics](report-evidence/api-metrics-native.png), [JSON](report-evidence/local-runtime.json). Chưa đạt yêu cầu tất cả targets Docker UP. |
| 10 | MySQL exporter | NOT VERIFIED | Compose có exporter riêng, user bootstrap không dùng root, grants giới hạn. Không có process exporter native đang phục vụ; `mysql_up` chưa có sample. Chưa kiểm chứng container kết nối MySQL. |
| 11 | cAdvisor/container metrics | NOT VERIFIED | Có service/mounts/cấu hình Prometheus và dashboard; chưa có cAdvisor chạy, chưa có sample gắn nhãn Compose CookShare. Không dùng metrics host để thay thế container metrics. |
| 12 | Grafana dashboard, datasources và biểu đồ | NOT VERIFIED — đủ stack | Bài Grafana native **1/1 PASS**, 11 panels, Prometheus/Loki datasource health OK, API có dữ liệu. [JUnit](report-evidence/grafana-native-test.xml), [dashboard thực](report-evidence/grafana-native.png). Các biểu đồ DB/container chưa có dữ liệu, Docker provisioning chưa kiểm chứng. |
| 13 | Alloy gửi log vào Loki | PASS — native file tail | Alloy native đọc stdout file của API đang chạy, gửi Loki; readiness và truy vấn có dữ liệu thật. [Alloy](report-evidence/alloy-native.png), [runtime JSON](report-evidence/local-runtime.json). **Docker discovery/socket proxy chưa kiểm chứng**, không dùng ảnh native để kết luận container ingestion PASS. |
| 14 | Ít nhất 3 truy vấn LogQL | PASS — Loki native | Raw API logs; JSON errors status >=400; count theo status. Truy vấn metric đã sửa `__error__=""`, chạy có kết quả. [query 1](report-evidence/logql-1-native.png), [query 2](report-evidence/logql-2-native.png), [query 3](report-evidence/logql-3-native.png). |
| 15 | Hardening, network, quyền DB và secrets | NOT VERIFIED — runtime containers | Khai báo non-root image/API, cap_drop, no-new-privileges, internal DB network, loopback management, read-only API và phân quyền DB có sẵn/được bổ sung. `.env` không tracked; `.dockerignore` chặn `.env.*`. Compose config đã validate; **chưa inspect UID/caps, thử DDL-denied hay quyền volume trong container**. Native DB là DB phát triển, không đại diện grants Docker. |

## Lỗi phát hiện và xử lý

1. **429 không phải JSON:** thực tế frontend từng nhận `Unexpected token 'T'` khi limiter trả `Too many requests...`. Sửa handler limiter API/auth trả `{error: ...}`, test mới xác nhận 429 JSON và RateLimit header. Không đổi nghiệp vụ hay giao diện.
2. **LogQL count lỗi JSONParserErr:** stdout có cả dòng không phải JSON. Đã tái hiện HTTP 400, thêm `| __error__=""` sau `| json` vào truy vấn metric và hướng dẫn, chạy lại có dữ liệu.
3. **Thiếu ngăn `.env.*` trong Docker context:** thêm pattern và ngoại lệ `.env.example`; tránh đưa file cấu hình riêng vào COPY build. Không có bằng chứng secrets đã bị leak.
4. **Nginx chưa có healthcheck; migration thiếu cap_drop:** thêm kiểm tra HTTP liveness qua Nginx; migration/seed read-only, migration drop ALL. Đây là sửa cấu hình; runtime còn NOT VERIFIED vì mục 03.
5. **Chuẩn bị cấu hình thủ công dễ dùng mật khẩu ví dụ:** thêm `Initialize-De29.ps1`, random độc lập, không in giá trị, không ghi đè `.env` đang có; kiểm tra độ mạnh và placeholder trước khi chạy verifier.
6. **Test bcrypt timeout 5 giây khi máy tải cao:** lượt đầu 27 PASS; lượt lưu artifact có 1 timeout. Đặt test timeout 15s/hook 30s, chạy lại toàn bộ sau thêm test mới: 28 PASS. Không thay thời hạn JWT, bcrypt cost hoặc timeout API.
7. **Smoke trước đây chỉ xem phpMyAdmin HTTP và một query log:** đổi nhãn rõ HTTP-only; thêm kiểm tra datasource status, 3 query LogQL, timeout network và script PowerShell kiểm tra SQL/quyền/mounts/ports khi có stack.
8. **Docker Desktop storage bị read-only khi pull image:** lỗi môi trường còn tồn tại. Đã dừng Docker Desktop sau lần thử, giữ nguyên data/volumes. Cần giải phóng/chuyển Docker disk sang ổ đủ chỗ, khởi động lại và chạy kiểm tra container; không tự dùng prune/reset/down -v.

## File thay đổi trong lượt DevOps

- `.dockerignore`, `docker-compose.yml`: context secrets, migration/seed hardening, Nginx healthcheck.
- `backend/src/app.ts`, `backend/src/routes/auth.ts`, `backend/tests/rate-limit.test.ts`, `backend/package.json`: 429 JSON và độ ổn định test.
- `scripts/Initialize-De29.ps1`, `scripts/Test-De29.ps1`: tạo cấu hình và kiểm tra stack Windows.
- `scripts/verify-stack.mjs`: kiểm tra HTTP, targets/samples, Grafana health, LogQL.
- `scripts/collect-local-evidence.mjs`, `scripts/capture-de29-evidence.mjs`: snapshot bổ trợ native và screenshot browser thật.
- `docs/DEPLOYMENT.md`, `docs/DE29_CHECKLIST.md`, `docs/report-evidence/README.md`, các artifacts trong thư mục evidence.

Các sửa Auth/Profile/catalog đã có từ các yêu cầu trước được giữ nguyên. Không reset working tree, không viết lại dự án, không đổi giao diện và không push GitHub trong lượt này.

## Chạy từ đầu trên Windows PowerShell

Cần Docker Desktop Linux Engine/WSL2 hoạt động, Git, Node.js 22.16+, ít nhất **5 GiB trống** (nên 10 GiB trở lên cho images/build). Cài đặt đúng thư mục repo, không tạo `.env` từ ví dụ rồi giữ mật khẩu mẫu.

```powershell
cd 'C:\Users\Admin\Downloads\Bai 07\CookShare'
# Mở Docker Desktop, chờ docker info thành công.
docker info
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Initialize-De29.ps1
# Chỉ chạy Initialize khi CHƯA có .env. Nếu đã có, giữ credentials hiện tại.
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-De29.ps1 -Start
```

Script Start build/up full Compose + profile tools, seed và kiểm tra. Nếu dịch vụ mới còn ở trạng thái starting, chờ 30–60 giây rồi chạy `Test-De29.ps1` lần nữa. File report có FAIL sẽ trả exit code 1, không đánh dấu PASS giả.

Các lệnh tương đương để trình bày từng bước:

```powershell
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml --profile tools config --quiet
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml --profile tools up -d --build
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml --profile tools run --rm seed
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml --profile tools ps -a
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Test-De29.ps1
```

Website Docker http://localhost:8080; phpMyAdmin http://localhost:8081; Prometheus http://localhost:9090; Grafana http://localhost:3001. Đăng nhập phpMyAdmin bằng DB_USER/DB_PASSWORD, server db; Grafana user admin và GRAFANA_ADMIN_PASSWORD; CookShare admin@cookshare.local và SEED_ADMIN_PASSWORD. Đọc mật khẩu từ `.env` trên máy, không đưa vào ảnh/README/commit.

Nếu các bản native đang dùng 3001/9090/3100, dừng đúng các process native đó trước khi chạy Docker để tránh trùng cổng. Website native đang có tại http://localhost:3000 chỉ là fallback, không thay cho demo Compose.

## Cách thu ảnh cho 15 mục

Xem [report-evidence/README.md](report-evidence/README.md). Không chụp `.env`, `docker inspect` đầy đủ, form đang hiển thị password, token DevTools hoặc logs chứa request body. Tập tin report/PDF cũ ngày 15/10 là snapshot cũ (21 món), cần dùng checklist và ảnh ngày 22/10 cho báo cáo cập nhật.
