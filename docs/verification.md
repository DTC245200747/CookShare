# Kết quả kiểm thử thực tế

Ngày **15/10/2026**, Windows, Node.js 22.16.0, MySQL Community 8.0.46, Chrome thực cài trên máy. Dự án local dùng database `cookshare_local`; integration dùng `cookshare_test`. Cả hai nằm trong MySQL instance riêng cổng 3307, data directory trong workspace `.tools`, không đụng đến database dự án khác.

## Backend/database

- `npm run build`: pass.
- Hai migrations áp dụng thành công; chạy lại không tạo thêm lịch sử.
- Seed 21 công thức tiếng Việt, 6 categories; seed lặp thành công, không reset password cũ.
- **21/21 tests pass, 2 files, không skip**, Vitest 5.0.4. Lượt cuối sau tách config DB khỏi JWT và thay cách truyền secrets Compose: **9.74 giây**, bắt đầu 17:31:21 giờ Việt Nam.
- Tests dùng HTTP Supertest và MySQL thật; không mock DB/repository.
- Kiểm tra auth đúng/sai, email trùng, role/owner, validation, FK/cascade, transaction rollback, search/filter/pagination, profile, favorites/rating/comment, upload giả/SVG/quá lớn/thật, moderation, user active, password/logout revoke và metrics.
- `npm audit --omit=dev` backend sau bổ sung dependencies: **0 vulnerabilities**. Khi cài frontend/Playwright và backend deps, npm audit cũng báo 0; không thay thế kiểm toán image Docker.

## Website và trình duyệt

- React TypeScript + Vite build pass. Bản build cuối: CSS ~31.22 kB, JS ~289.62 kB trước gzip.
- **4/4 Playwright tests pass**, Chrome: 3 kịch bản website + 1 Grafana, tổng **35.8 giây**.
- Kịch bản public: trang chủ, ảnh thật, tên/nguyên liệu/thời gian/độ khó, pagination, chi tiết và checkbox nguyên liệu.
- Kịch bản tài khoản: sai login → đăng ký → login → sửa hồ sơ/upload avatar → tạo recipe/upload ảnh → preview → đăng → favorite → rate → comment thêm/sửa/xóa → sửa recipe → xóa → logout.
- Kịch bản admin: dashboard SQL, category CRUD, tìm kiếm, moderation, bảng users; member/admin separation kiểm tra thêm ở backend.
- Sau bổ sung coverage cho nguyên liệu mới và đổi password trên UI, chạy riêng lại kịch bản account: **1/1 pass, 14.2 giây**. Đã thêm ingredient mới, lưu vào recipe thật, đổi password và đăng nhập lại bằng password mới.
- Viewports 1440×1000, 820×1100, 390×844: không tràn ngang, ảnh load thành công. Đã xem screenshots desktop và mobile.
- Screenshots lưu ở [screenshots](screenshots/), báo cáo PDF [CookShare-report.pdf](CookShare-report.pdf).

## Monitoring portable đã chạy

Vì Docker daemon chưa hoạt động, đã tải bản portable chính thức và chạy trên loopback: Prometheus 3.15.0, MySQL exporter 0.20.0, Loki 3.7.8, Alloy 1.20.1, Grafana OSS 13.2.4.

- Prometheus: target API và MySQL đều `up=1`; `mysql_up=1`; có `cookshare_http_requests_total`, `mysql_global_status_threads_connected` và query metrics.
- Alloy: đọc stdout log file local của API, đẩy Loki. Đây là pipeline file tail thực tế, chưa phải Docker discovery.
- Loki: đã chạy ba LogQL, trả success và dữ liệu: raw API logs; JSON status >=400; count_over_time.
- Grafana: database OK, datasource Prometheus và Loki health OK; dashboard `cookshare-overview` provision thành công **11 panels**. Browser Grafana test pass và screenshot có metrics thực.
- `alloy validate monitoring/alloy/config.alloy`: pass cho cấu hình Docker pipeline.
- `loki -config.file=monitoring/loki/loki.yml -verify-config=true`: pass.
- `promtool check config`: pass; kiểm tra dùng bản tạm chỉ đổi đường dẫn alert file Linux sang local. `promtool check rules`: pass **3 alert rules**.

## Docker, CI và giới hạn

- `docker compose -f docker-compose.yml -f docker-compose.monitoring.yml --env-file .env.example config --quiet`: **pass** sau cập nhật frontend container, seed service và tách secrets.
- Bash syntax `database/init/20-users.sh`: pass.
- Docker CLI 29.7.2 có sẵn nhưng daemon không hoạt động. Chưa build/run Dockerfiles, Nginx/phpMyAdmin/cAdvisor, bootstrap tài khoản DB production, hoặc pipeline Docker socket → Alloy.
- Chưa có samples CPU/memory container trong bản portable; dashboard có panel nhưng không coi là đã xác minh thu thập container.
- GitHub Actions đã có backend/browser và stack smoke workflows; chưa có bằng chứng chúng đã chạy trên GitHub tại thời điểm viết báo cáo.
- Chưa triển khai public HTTPS. Báo cáo PDF cần điền thông tin sinh viên; không tự suy đoán tên/MSSV.

## Tái kiểm tra

Lệnh chạy local và tests ở [README](../README.md); payload ở [API](api.md); Docker/monitoring ở [DEPLOYMENT](DEPLOYMENT.md). Khi Docker chạy, dùng `node scripts/verify-stack.mjs` để xác minh HTML, DB, targets/samples, dashboard/datasources và log ingestion. Không đánh dấu các mục Docker NOT VERIFIED thành DONE chỉ vì Compose config hợp lệ.

Xuất lại PDF sau chỉnh trang bìa: cài frontend dependencies, đặt `E2E_CHROME=1` nếu dùng Chrome, chạy `node scripts/export-report.mjs`. Lần export đã xác minh đúng **10 trang A4**, ảnh load đủ, nội dung không tràn khung trang.
