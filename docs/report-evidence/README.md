# Minh chứng Đề 29 — 22/10/2026

Chỉ chứa ảnh chụp trình duyệt thật và kết quả lệnh/test đã thực chạy. Ảnh `*-native.png` và các ảnh UI được lấy từ dịch vụ native Windows ở cổng 3000/3001/9090/3100/12345, **không phải Docker**. Không tạo ảnh khi dịch vụ chưa chạy.

## Artifacts hiện có

- `backend-tests.json`: 28 backend tests PASS với DB MySQL test riêng.
- `browser-tests.xml`: 5 UI tests PASS, 1 Grafana test SKIPPED vì được chạy riêng.
- `grafana-native-test.xml`: bài Grafana riêng 1 PASS, 11 panels và 2 datasource healthy. DB/container panels còn thiếu samples.
- `backend-dependencies.json`, `frontend-dependencies.json`: npm audit tất cả dependencies, 0 advisory tại lúc chạy; không phải bảo đảm không còn mọi lỗ hổng.
- `powershell-checks.json`: Compose static checks PASS, containers FAIL/chưa chạy; đây là kết quả lần thử, không sửa thủ công thành PASS.
- `docker-blocker.json`: ghi nhận dung lượng đĩa và trích lỗi thực khi tải image; không phải bản log Docker đầy đủ.
- `compose-static.json`: Compose đã resolve và được lọc để chỉ giữ tên biến môi trường, networks/ports/volumes/caps/healthchecks; không chứa giá trị secrets, không phải inspect runtime.
- `local-runtime.json`: SQL/metrics/logs/readiness thật; job MySQL DOWN được giữ nguyên trong bằng chứng.
- `capture-manifest.json`: URL, thời điểm và trạng thái ảnh monitoring được chụp thực tế. Các ảnh web/admin lấy từ Playwright run có JUnit ở trên.

`container-runtime.json`, `database-hardening.json`, `stack-http-checks.txt` chỉ được script tạo khi đi tới bước đó. Nếu chưa có file thì chưa có bằng chứng container tương ứng.

## Hướng dẫn chụp cho 15 mục báo cáo

| Mục | Mở/chạy để lấy ảnh thật | Nội dung cần nhìn thấy |
|---|---|---|
| 01 GitHub | Repository → Code và Commits | URL repo, source/config, ít nhất 3 commit có ý nghĩa; chỉ chụp sau khi đã cập nhật bản cần nộp |
| 02 Build/dependencies | `cd backend; npm run build; npm test`, frontend `npm run build`, `npm audit` | Lệnh và summary thành công; không cần chụp chi tiết body requests |
| 03 Docker Compose | Full Compose `ps -a`, `docker compose ... config --quiet` | Tên services, trạng thái Running/Healthy và migrate Exited(0), phiên bản Compose; không chụp config chứa mật khẩu |
| 04 Frontend | http://localhost:8080 trên desktop và DevTools mobile | Hero, danh sách, chi tiết và dashboard đăng nhập đúng quyền; ghi kích thước viewport |
| 05 API/CRUD | Tạo món qua website, sửa tiêu đề, tìm lại, xóa và xác nhận không còn | Trước/sau và thông báo thành công. Có thể dùng SQL mục 06 xác nhận dữ liệu thực |
| 06 MySQL | phpMyAdmin SQL, chạy câu SQL bên dưới | Schema/migrations, số lượng và dữ liệu món vừa tạo; không chụp bảng password_hash |
| 07 phpMyAdmin | http://localhost:8081, đăng nhập DB user runtime | Trang sau đăng nhập, danh sách bảng và kết quả SQL SELECT; không chụp lúc nhập mật khẩu |
| 08 Nginx | DevTools Network truy cập 8080 và `/api/v1/recipes`; `docker compose exec nginx nginx -t` | 200 qua proxy, X-Frame-Options/CSP/nosniff, `/metrics` trả 404. 3000 native không chứng minh Nginx |
| 09 Prometheus | http://localhost:9090/targets | cookshare-api, mysql, containers và prometheus đều UP; ảnh native hiện tại có mysql DOWN nên chưa đạt |
| 10 MySQL exporter | Prometheus query `mysql_up` và `mysql_global_status_threads_connected` | mysql_up=1, connection samples thật, target mysql UP |
| 11 cAdvisor | Query `container_memory_working_set_bytes{container_label_com_docker_compose_project="cookshare"}` | Kết quả có container CookShare, không chỉ root/host samples |
| 12 Grafana | http://localhost:3001 → CookShare dashboard; Connections → Data sources | 11 panels có API/DB/container data, Prometheus/Loki Save & test/health thành công; sinh traffic trước khi chụp |
| 13 Alloy/Loki | `docker compose ... logs --tail 30 alloy`, Grafana Explore Loki | Collector không có lỗi push/discovery và có logs nhãn service=api/nginx của Docker; che dữ liệu nhạy cảm nếu phát sinh |
| 14 LogQL | Grafana Explore với 3 truy vấn bên dưới | Query cùng kết quả không rỗng; query count có giá trị và status labels |
| 15 Hardening | Chạy `Test-De29.ps1`, xem JSON đã lọc | UID API/Nginx khác root, capDrop ALL, no-new-privileges, internal network, management loopback, DDL denied và volume upload writable |

SQL an toàn để chụp:

```sql
SELECT name FROM schema_migrations ORDER BY name;
SELECT c.name, COUNT(r.id) AS recipes
FROM categories c LEFT JOIN recipes r ON r.category_id=c.id
GROUP BY c.id,c.name;
SELECT id,title,category_id,prep_minutes,cook_minutes
FROM recipes ORDER BY id DESC LIMIT 10;
```

LogQL đã kiểm chứng trên Loki native:

```logql
{job="cookshare",service="api"}
{job="cookshare",service="api"} | json | __error__="" | status >= 400
sum by(status)(count_over_time({job="cookshare",service="api"} | json | __error__="" [5m]))
```

Sinh request thật tới `/api/v1/recipes` và một URL API không tồn tại trước khi kiểm tra query lỗi/count; đợi Alloy gửi log và Prometheus scrape 15–30 giây. Chỉ có API/404 của demo, không tạo lỗi bằng cách phá DB hay service.

Tự thu lại ảnh native (không thay thế ảnh Docker):

```powershell
$env:E2E_CHROME='1' # Chrome đã cài; bỏ biến nếu dùng Chromium của Playwright
node scripts/collect-local-evidence.mjs
node scripts/capture-de29-evidence.mjs
```

Các script này không lấy password, token hay toàn bộ environment để lưu evidence. Đọc lại ảnh trước khi commit; không upload `.env`, trace ZIP hoặc báo cáo chứa request headers. Nếu chạy lại `Test-De29.ps1`, kết quả lần mới sẽ ghi đè file kiểm tra cùng tên, vì vậy lưu một bản theo ngày nếu cần giữ lịch sử.
