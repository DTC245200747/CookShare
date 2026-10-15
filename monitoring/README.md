# Monitoring

Chạy bằng `docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d --build`. Prometheus scrape API/MySQL/cAdvisor; Grafana tự provision dashboard + hai datasource; Alloy gửi Docker logs vào Loki qua socket proxy giới hạn quyền.

Xem [DEPLOYMENT](../docs/DEPLOYMENT.md) để biết ports, credentials, PromQL/LogQL, hardening, cách nâng cấp volume và smoke test. Xem [verification](../docs/verification.md) để phân biệt kiểm tra portable đã thực chạy và Docker chưa được xác minh.
