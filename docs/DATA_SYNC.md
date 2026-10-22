# Đồng bộ MySQL Windows → Docker

Ngày thực hiện: 22/10/2026. **Đã được người dùng xác nhận và cutover thành công. localhost:8080 đang dùng database/volume đã đồng bộ.**

## Những gì đã thực hiện

- Nguồn: MySQL 8.0.46, `127.0.0.1:3307/cookshare_local`.
- Database cũ trong Docker: MySQL 8.4.13, `cookshare`, giữ nguyên.
- Database mới: `cookshare_sync_20261022121306_13d09f` trong cùng MySQL Docker.
- Volume uploads mới: `cookshare_uploads_sync_20261022121306_13d09f`; volume `cookshare_uploads` cũ giữ nguyên.
- Website chính Docker/Nginx: **http://localhost:8080**, hiện có 141 công thức. Windows :3000 và staging :18080 vẫn được giữ nguyên để đối chiếu.

Backup riêng tư ở ngoài repository:

```text
C:\Users\Admin\Downloads\Bai 07\.tools\backups\cookshare-sync-20261022121306_13d09f\
  windows-source.sql
  docker-original.sql
  windows-uploads\
  docker-original-uploads\
  api-rootfs.tar
  nginx-rootfs.tar
  original-api.env
  staging-api.env
  before-snapshots.json
  after-staging-snapshot.json
  state.json
```

Thư mục được giới hạn ACL cho tài khoản hiện tại, SYSTEM và Administrators. Dump có dữ liệu tài khoản và password hashes; file env riêng chứa credentials. **Không đưa toàn bộ thư mục này lên GitHub, ảnh báo cáo hoặc gửi qua chat.**

Logical dump dùng `--single-transaction`, không khóa bảng, không tạo/xóa database và không có DROP TABLE. Nguồn đều là InnoDB; checksum trước/sau chứng minh dữ liệu không đổi trong quá trình backup. Import chỉ vào database mới, có kiểm tra tên chưa tồn tại. Không chạy seed, không đổi mật khẩu và không chỉnh ID.

Image ID cũ của các container đang chạy đã không còn trong image store. Để giữ đúng code đang chạy và có đường rollback, đã export filesystem container **không pause/stop**, giữ tar backup, import thành image local mới với metadata không chứa password/JWT. Hai service đang phục vụ :8080 không bị tạo lại. Cấu hình cutover pin image đã qua staging, không pull/rebuild trong lúc chuyển.

## Kết quả kiểm tra

| Bảng/hạng mục | Số lượng / kết quả |
|---|---:|
| recipes | 141 |
| users | 17 |
| categories | 6 |
| ingredients | 172 |
| recipe_ingredients | 635 |
| recipe_steps | 424 |
| user_profiles | 13 |
| user_security | 15 |
| recipe_moderation | 2 |
| schema_migrations | 2 |
| favorites / ratings / comments | 0 / 0 / 0, đúng nguồn |
| Uploads | 26/26, SHA-256 từng file khớp |
| Khóa ngoại | 14 kiểm tra, 0 orphan rows |
| SQL dữ liệu | Checksum toàn bộ 13 bảng, cột và FK khớp nguồn |
| REST API | 141/141 chi tiết có ingredients và steps |
| HTTP ảnh | 20 URL ảnh hiện được tham chiếu trả 200 image; 13 avatar upload khớp hash file nguồn |
| Đăng nhập | Tài khoản admin nguồn đăng nhập được trên Windows và staging; mật khẩu không thay đổi |
| Browser staging | Trang chủ, ảnh, chi tiết, đăng nhập và admin 17 users/141 recipes PASS; 0 lỗi JavaScript |

Không chỉ kiểm tra số dòng: checksum bao gồm toàn bộ giá trị, nên IDs, password hashes, timestamps và các quan hệ đều được bảo toàn. Chỉ thực hiện đăng nhập và thao tác đọc trong bước browser/API validation, không thêm dữ liệu test vào database nhập.

Bằng chứng không chứa secrets:

- [staging SQL/API](report-evidence/data-sync-staging.json)
- [browser](report-evidence/data-sync-preview-browser.json)
- [kế hoạch cutover](report-evidence/data-sync-cutover-plan.json)
- [kết quả sau cutover](report-evidence/data-sync-production.json)
- [browser trên :8080](report-evidence/data-sync-production-browser.json)
- [trạng thái hiện tại](report-evidence/data-sync-status.json)
- [health sau đồng bộ](report-evidence/data-sync-health.json)
- [trang chủ staging](report-evidence/data-sync-preview-home.png)
- [chi tiết staging](report-evidence/data-sync-preview-detail.png)
- [dashboard staging](report-evidence/data-sync-preview-admin.png)

## Cutover đã thực hiện sau xác nhận

`docker-compose.synced.yml` và `docker-compose.rollback.yml` đã được chuẩn bị, validate Compose và kiểm tra không thay `MYSQL_DATABASE=cookshare` của service DB. Credentials Compose đã được đối chiếu với API hiện đang chạy, không in ra.

Bước tạo lại container API có thể gây gián đoạn ngắn; Nginx phải reload để cập nhật upstream/IP. Đã dừng ở staging để xin xác nhận, sau đó người dùng trả lời “tiếp”. Đã tạo lại **chỉ API**, chờ healthy, chạy `nginx -t` và reload Nginx. Không dùng `--build`, không chạy seed, không down/reset/remove volume.

Các lệnh cutover đã thực hiện từ gốc CookShare, lưu ở đây để đối chiếu (không cần chạy lại khi chỉ muốn mở web):

```powershell
# Kiểm tra dữ liệu không phát sinh thay đổi kể từ staging; FAIL thì dừng để đối chiếu lại.
node scripts/check-data-cutover.mjs

docker compose -f docker-compose.yml -f docker-compose.monitoring.yml -f docker-compose.synced.yml --profile tools up -d --no-deps --no-build api

# Chờ API healthy trước khi reload Nginx.
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml -f docker-compose.synced.yml ps api
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml -f docker-compose.synced.yml exec -T api node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>process.exit(r.ok?0:1))"
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml -f docker-compose.synced.yml exec -T nginx nginx -s reload
```

Sau chuyển đổi đã xác nhận :8080 có 141 món, 141 chi tiết, toàn bộ 26 upload đúng checksum (33 URL ảnh gồm ảnh stock và upload đều trả image/200), đăng nhập qua UI và dashboard 17/141. API chạy UID 1000, read-only và healthy. Guard SQL kiểm tra lại nguồn Windows, database Docker cũ và database synced: toàn bộ dữ liệu vẫn khớp snapshot. Dùng mật khẩu **của tài khoản Windows đã chuyển sang**; `SEED_ADMIN_PASSWORD` trong `.env` Docker không reset mật khẩu tài khoản nhập.

Lệnh khởi động những lần sau, **sau khi cutover đã thành công**:

```powershell
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml -f docker-compose.synced.yml up -d --no-deps --no-build db api nginx
```

Hoặc dùng script PowerShell đã đóng gói đúng cấu hình:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Start-Synced.ps1
```

Script mặc định chỉ mở DB/API/Nginx; database đã import đầy đủ nên không cần chạy lại migrate/seed để demo. Có thể thêm `-WithMonitoring` để mở monitoring. `-WithTools` chỉ dùng khi image phpMyAdmin hoạt động. Trong lần kiểm tra sau cutover, tạo phpMyAdmin gặp lỗi Docker snapshot storage `failed to stat parent ... snapshots/56/fs: no such file or directory`; tool chưa chạy ở :8081, nhưng web/API :8080 đã kiểm chứng và không phụ thuộc phpMyAdmin. Không reset Docker/xóa volume để sửa lỗi image này.

Sau cutover đã đọc kiểm tra: Prometheus targets API/MySQL/container UP, `mysql_up=1`, Grafana dashboard 11 panels và hai datasource health OK. Truy vấn Loki Docker chưa có dữ liệu/labels tại thời điểm kiểm tra; log Alloy có cảnh báo `unexpected EOF` ở một số container. Ghi nhận là chưa xác minh thành công logging Docker, không đánh dấu toàn bộ hệ thống giám sát PASS. Việc đồng bộ dữ liệu ứng dụng và kiểm tra :8080 đã hoàn tất độc lập với hai hạn chế công cụ này.

Đây là chuyển dữ liệu một lần, không phải replication hai chiều. Dùng :8080 làm nơi demo/cập nhật dữ liệu sau chuyển đổi; nếu tiếp tục sửa cả :3000 và :8080 thì cần kế hoạch đối chiếu riêng, không nhập đè để cố làm giống nhau.

Luôn dùng cùng override synced, nếu không API có thể quay về database cũ. Staging :18080 vẫn được giữ để đối chiếu; dọn container/network thử nghiệm chỉ khi được cho phép, không xóa database/volume backup.

## Rollback — cũng cần xác nhận trước thao tác gián đoạn

Nếu đã chuyển mà phát hiện lỗi, có thể khôi phục API về database `cookshare` và volume uploads cũ bằng cấu hình đã chuẩn bị:

```powershell
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml -f docker-compose.rollback.yml --profile tools up -d --no-deps --no-build api
# Chờ API healthy như trên, rồi reload Nginx:
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml -f docker-compose.rollback.yml exec -T nginx nginx -s reload
```

Database Docker cũ hiện có 0 công thức, nên rollback về trạng thái cũ cũng sẽ hiển thị 0 món. Database/volume synced vẫn tồn tại, không mất các dữ liệu mới viết sau cutover; cần đối chiếu dữ liệu phát sinh trước khi chuyển qua lại. Không import dump đè database đang dùng, không sao chép thư mục MySQL 8.0 vào data directory MySQL 8.4.

## Scripts

- `stage-docker-data.mjs`: backup và tạo staging tách biệt; không tự cutover. Resume chỉ dành cho trạng thái staging chưa chuyển, luôn so sánh dữ liệu gốc trước khi tiếp tục.
- `verify-synced-preview.mjs`: browser đọc dữ liệu thật ở :18080, không mock route hoặc ghi nội dung tài khoản vào artifacts.
- `check-data-cutover.mjs`: guard chỉ đọc, phát hiện thay đổi dữ liệu trước switch.
- `prepare-data-cutover.mjs`: chuẩn bị/validate cấu hình rollback, không thay container.

Các scripts dùng Node 22; máy hiện tại có portable Node ở `.tools/node.exe` của workspace nếu chưa thêm Node vào PATH.
