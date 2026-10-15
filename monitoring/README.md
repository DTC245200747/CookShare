# Monitoring

Chạy bằng `docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d --build`. Prometheus scrape API/MySQL/cAdvisor; Grafana tự provision dashboard + hai datasource; Alloy gửi Docker logs vào Loki qua socket proxy giới hạn quyền.

Xem [DEPLOYMENT](../docs/DEPLOYMENT.md) để biết ports, credentials, PromQL/LogQL, hardening và smoke test. [CI_EVIDENCE](../docs/CI_EVIDENCE.md) xác nhận Docker stack đã chạy thành công trên Linux CI. Local có bản portable thực chạy; Docker Desktop Windows chưa được kiểm chứng.
