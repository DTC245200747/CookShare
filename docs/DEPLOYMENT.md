# Triển khai và vận hành

## Docker Compose

Yêu cầu Docker Engine + Compose v2 hoạt động. Từ gốc repository:

```powershell
Copy-Item .env.example .env
# Thay tất cả mật khẩu và JWT_SECRET; xem quy tắc bên dưới.
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml --profile tools up -d --build
docker compose run --rm seed
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml ps
```

Mật khẩu migration/exporter cần ít nhất 20 ký tự trong `[A-Za-z0-9_-]` để script bootstrap SQL thay biến an toàn. JWT_SECRET cần ít nhất 32 ký tự. Không dùng cùng username runtime và migration. Các mật khẩu ví dụ phải được đổi trước khi đưa lên Internet.

| Dịch vụ | Địa chỉ |
|---|---|
| CookShare qua Nginx | http://localhost:8080 |
| phpMyAdmin (profile tools) | http://localhost:8081 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 |
| Loki readiness | http://localhost:3100/ready |

phpMyAdmin đăng nhập DB_USER/DB_PASSWORD, server `db`. Grafana dùng user `admin` và GRAFANA_ADMIN_PASSWORD. Các công cụ quản trị chỉ bind `127.0.0.1`. MySQL không publish port. Nginx là cổng web duy nhất, phục vụ React và reverse proxy API/upload. `/metrics` bị chặn ở Nginx, Prometheus truy cập trực tiếp qua network nội bộ.

MySQL bootstrap trong `database/init/20-users.sh` tách tài khoản migration có DDL và runtime chỉ SELECT/INSERT/UPDATE/DELETE trên schema CookShare. User exporter chỉ có PROCESS/REPLICATION CLIENT và SELECT trên performance_schema; không dùng root để scrape. Bootstrap chỉ tự chạy với volume DB mới. Nếu nâng cấp từ volume giai đoạn 1, backup trước rồi chạy:

```powershell
docker compose exec db bash /docker-entrypoint-initdb.d/20-users.sh
docker compose run --rm migrate
```

Nếu thay mật khẩu migration/exporter sau khi DB đã khởi tạo, cập nhật tương ứng bằng `ALTER USER` qua tài khoản quản trị DB; `CREATE USER IF NOT EXISTS` không tự đổi mật khẩu cũ.

## Kiểm tra stack

```powershell
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml exec prometheus promtool check config /etc/prometheus/prometheus.yml
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml exec alloy alloy validate /etc/alloy/config.alloy
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml exec loki /usr/bin/loki -config.file=/etc/loki/loki.yml -verify-config=true
$env:GRAFANA_ADMIN_PASSWORD='your-grafana-password'
node scripts/verify-stack.mjs
```

Smoke script kiểm tra HTML frontend, kết nối MySQL, các target API/MySQL/container đang UP, có samples, Grafana datasource/dashboard và log API đã vào Loki. Cho hệ thống khoảng một phút sau khởi động để có samples/logs. GitHub workflow `stack.yml` chạy cùng luồng trên Linux; không xem workflow đã viết là bằng chứng workflow đã pass.

## Metrics và dashboard

Grafana tự provision hai datasource Prometheus/Loki và dashboard **CookShare — Web, Database & Containers** gồm trạng thái API/DB, request rate/status, p95 latency, query rate/connections MySQL, memory API, CPU/memory container và log ứng dụng. Dashboard lưu tại `monitoring/grafana/dashboards/cookshare.json`. Alert rules phát hiện API/DB down và tỷ lệ lỗi 5xx cao; chưa cấu hình kênh gửi thông báo bên ngoài.

PromQL mẫu:

```promql
up{job="cookshare-api"}
mysql_up
sum by(status)(rate(cookshare_http_requests_total[5m]))
histogram_quantile(0.95, sum by(le)(rate(cookshare_http_request_duration_seconds_bucket[5m])))
container_memory_working_set_bytes{container_label_com_docker_compose_project="cookshare"}
```

## Log tập trung và LogQL

Alloy khám phá container CookShare qua socket proxy chỉ cho đọc, gán nhãn `job=cookshare`, `service=<compose service>`, gửi đến Loki. API ghi JSON status/method/route/duration; không log mật khẩu, token hoặc body. Nginx ghi stdout/stderr. Xem bằng Grafana Explore → Loki:

```logql
{job="cookshare",service="api"}
{job="cookshare",service="api"} | json | status >= 400
sum by(status)(count_over_time({job="cookshare",service="api"} | json [5m]))
{job="cookshare",service="nginx"} |= "GET /api/"
```

Prometheus/Loki giữ dữ liệu 7 ngày, volume riêng. Loki không có auth trong mạng nội bộ và không được expose ra Internet. cAdvisor cần quyền đọc filesystem/cgroup/socket của Docker host; trên Docker Desktop/cgroup layout khác Linux có thể cần điều chỉnh mount. Nó chỉ phục vụ network monitoring, không mở cổng host. Samples container đã xác minh trên Linux CI; Docker Desktop Windows chưa được kiểm chứng. Alloy chạy UID 473 đúng owner của volume; socket proxy cho GET container/network metadata nhưng chặn POST. Các trang quản trị có management bridge và vẫn chỉ publish cổng loopback.

## Bảo mật và dữ liệu

- API chạy user `node`; frontend Nginx unprivileged; bỏ Linux capabilities ở các dịch vụ phù hợp, `no-new-privileges`.
- API filesystem read-only trừ volume uploads. DB và monitoring có network riêng; API không mở port trực tiếp trong Compose.
- Mật khẩu bcrypt cost 12, JWT HS256 có issuer/audience, thời hạn 1 giờ. Logout/đổi mật khẩu/khóa user tăng token_version, vô hiệu hóa phiên cũ.
- Phân quyền thực hiện ở backend; chỉ owner/admin sửa/xóa recipe, admin quản trị, member được thêm ingredient để viết công thức nhưng không sửa/xóa taxonomy dùng chung.
- Upload giới hạn 5 MB, loại JPEG/PNG/WebP, kiểm tra nội dung và số pixel bằng Sharp rồi mã hóa WebP, tên UUID. Không phục vụ SVG/HTML từ upload.
- Helmet/CSP, Nginx security headers, CORS origin, rate limit theo IP, validation và prepared parameters. Khi qua Nginx, `TRUST_PROXY=1` và Nginx ghi đè X-Forwarded-For. Không đưa API ra Internet sau một topology proxy khác mà giữ cấu hình này.
- Chạy public cần cấu hình TLS tại proxy/load balancer, đặt secure origins và backup. Không có HTTPS certificate được tạo tự động trong repo.

Backup database bằng công cụ quản trị MySQL; backup cả volume uploads. `docker compose down` giữ volume. Không dùng `down -v` cho dữ liệu cần giữ. Các ảnh upload chưa được gắn vào profile/recipe vẫn còn trên ổ đĩa; production cần định kỳ dọn file mồ côi sau khi đối chiếu dữ liệu và có backup.

Tham khảo cấu hình chính thức: [Prometheus](https://prometheus.io/docs/prometheus/latest/configuration/configuration/), [Loki](https://grafana.com/docs/loki/latest/configure/examples/configuration-examples/), [Alloy Docker logs](https://grafana.com/docs/alloy/latest/reference/components/loki/loki.source.docker/). Version image tra theo releases chính thức ngày 15/10/2026; pull/build/runtime đã pass trong [Linux CI](CI_EVIDENCE.md). Nếu đang chạy bản portable local ở cổng 3001/9090/3100, dừng các bản đó trước khi khởi động Docker để tránh trùng cổng.
