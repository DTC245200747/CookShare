# Minh chứng GitHub Actions

Source kiểm tra: `c9b0b41e033cbbbaa32ec6483fff1a3bc1098211`, ngày 15/10/2026.

- [Backend/MySQL/browser — SUCCESS](https://github.com/DTC245200747/CookShare/actions/runs/38732070508)
- [Docker stack, monitoring, hardening — SUCCESS](https://github.com/DTC245200747/CookShare/actions/runs/38732070475)

Các bước build/start stack, seed, validate monitoring, verify stack và runtime hardening đều thành công trên Ubuntu runner. Backend job dùng MySQL 8.4 thực; stack job build hai Dockerfiles và chạy Compose thực.

Trích job `116412006411`:

```text
2026-10-15T12:07:28.0070944Z PASS web and MySQL
2026-10-15T12:07:28.1630189Z PASS phpMyAdmin
2026-10-15T12:07:28.2042725Z PASS Prometheus targets
2026-10-15T12:07:36.2149187Z PASS cookshare_http_requests_total
2026-10-15T12:07:36.2161335Z PASS mysql_up
2026-10-15T12:07:36.2182654Z PASS container_memory_working_set_bytes{container_label_com_docker_compose_project="cookshare"}
2026-10-15T12:07:36.2204824Z PASS Grafana
2026-10-15T12:07:36.5921407Z PASS Loki logs
2026-10-15T12:07:36.5921801Z All stack checks passed.
2026-10-15T12:07:36.8326975Z Runtime user is non-root, DDL denied, uploads writable, unnecessary secrets absent.
```

Smoke yêu cầu sample container có nhãn Compose CookShare, không chỉ sample root/host. Kiểm tra thêm Nginx X-Frame-Options DENY và chặn public /metrics. Runtime xác nhận API non-root, DDL bị MySQL từ chối, uploads writable và không có root/migration/seed password trong environment API.

Artifact docker-stack-log lưu trạng thái/log của run. phpMyAdmin HTTP đã trả trang thật; chưa thao tác đăng nhập và quản trị DB bằng giao diện phpMyAdmin. Docker Windows local vẫn chưa chạy; kết quả Docker ở đây là Linux CI.

Đã sửa trước run thành công: quyền volume Alloy (UID 473), quyền đọc metadata networks qua socket proxy và management network cho công cụ quản trị. POST qua socket proxy vẫn bị chặn.
