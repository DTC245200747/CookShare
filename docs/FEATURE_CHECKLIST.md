# CookShare — kết quả triển khai

Kiểm tra ngày **15/10/2026**. DONE = triển khai và kiểm thử đạt; PARTIAL = một phần; FAILED = còn lỗi đã kiểm thử; NOT VERIFIED = chưa kiểm chứng. Bằng chứng/lệnh chạy ở [verification](verification.md), [DEPLOYMENT](DEPLOYMENT.md), tests và screenshots.

| Hạng mục | Trạng thái | Bằng chứng / phần còn lại |
|---|---|---|
| Audit, checklist, giữ backend giai đoạn 1 | DONE | Mở rộng cấu trúc hiện có; không sửa dự án khác |
| MySQL schema, PK/FK/unique/CHECK | DONE | 21 integration tests, FK/cascade/rollback, MySQL 8.0.46 thật |
| Migration và seed ≥20 công thức tiếng Việt | DONE | 21 công thức; chạy lặp seed/migration thành công |
| Đăng ký/đăng nhập đúng-sai/đăng xuất | DONE | Backend + browser; logout thu hồi token |
| Hồ sơ, bio và avatar upload | DONE | API lưu MySQL, browser upload/lưu hồ sơ |
| Đổi mật khẩu | DONE | Backend + browser đổi rồi đăng nhập lại; token cũ bị thu hồi |
| USER/ADMIN và owner authorization | DONE | Member bị chặn API admin, chặn sửa/xóa recipe/bình luận người khác |
| Tạo/sửa/xóa recipe, ingredients/steps, preview | DONE | Browser và MySQL integration; xác nhận xóa, ảnh/children thật |
| Thêm nguyên liệu còn thiếu khi viết recipe | DONE | Backend kiểm quyền và browser thêm, chọn và lưu |
| Upload an toàn | DONE | JPEG/PNG/WebP, ≤5MB, kiểm nội dung/pixel và re-encode; tests từ chối giả/SVG/quá lớn |
| Search theo tên/nguyên liệu, category/difficulty/time | DONE | Backend filters + browser kiểm kết quả |
| Sort mới nhất/popular/rating và pagination | DONE | SQL whitelist; API/UI có pagination, browser chuyển trang |
| Chi tiết tác giả/khẩu phần/ingredients/steps/ratings | DONE | API thật và browser; đánh dấu nguyên liệu |
| Favorites qua tài khoản/MySQL | DONE | Idempotent, bỏ lưu, saved list; không dùng localStorage thay database |
| Ratings 1–5, chống trùng và tính trung bình | DONE | Upsert unique user/recipe; hai user cho average 4; browser rate |
| Comments thêm/sửa/xóa/phân trang/owner | DONE | API và browser CRUD, admin xóa |
| Hồ sơ và bộ sưu tập riêng | DONE | /me/recipes, /me/saved; ProfileCollections và Bếp của tôi/Yêu thích |
| Dashboard admin, số liệu/biểu đồ | DONE | Counts SQL, activity/distribution; browser và screenshots |
| Quản lý user: role/active, revoke phiên | DONE | Backend integration, dashboard bảng và selectors |
| Admin CRUD taxonomy, quản lý recipe/comments | DONE | API + browser category CRUD/moderation; backend permissions |
| Moderation hidden/published | DONE | Public bị 404/ẩn khỏi list, owner vẫn xem được; browser toggle |
| UI trắng kem/cam/xanh lá, responsive | DONE | Chrome 1440/820/390px, ảnh tải thành công, không tràn ngang |
| Skeleton/toast/empty/error/confirm/form validation | DONE | Các luồng browser chạy thật, không success giả |
| Backend/React production build | DONE | tsc + Vite build pass |
| Git source, ignore secrets/artifacts, CI workflows | DONE | Đã push main; backend/browser và Docker workflows SUCCESS, xem CI_EVIDENCE.md |
| Docker Compose và Dockerfiles | DONE | Linux CI build/start/seed thật; Windows local daemon chưa chạy |
| Nginx reverse proxy và frontend static | DONE | Docker CI HTTP/DB ready, security headers và /metrics404 |
| phpMyAdmin | PARTIAL | Docker CI HTTP200; chưa thao tác login/query trên GUI |
| Prometheus API và MySQL metrics | DONE | Portable thực chạy: up API/MySQL=1, mysql_up=1, có HTTP/DB samples |
| Grafana datasource/dashboard 11 panel | DONE | Portable, datasource health OK; browser screenshot/dashboard API pass |
| Loki + Alloy thu log và ≥3 LogQL | DONE | Portable file tail → Loki, 3 query trả success/log thật |
| Docker log discovery qua socket proxy | DONE | Linux CI có log API thật vào Loki sau sửa UID/network metadata |
| cAdvisor CPU/memory container | DONE | Target UP, samples memory có nhãn Compose CookShare trong CI; chưa xác minh trên Windows |
| Hardening runtime cơ bản Docker | DONE | CI chứng minh API non-root, runtime DDL denied, upload writable, không có root/migration/seed secrets |
| HTTPS public | NOT VERIFIED | Không cấp chứng chỉ hoặc deploy Internet; có security headers theo đề |
| Báo cáo 10 trang và minh chứng | PARTIAL | PDF đúng 10 trang, không tràn, ảnh thật; cần điền tên/MSSV/lớp trước khi nộp |

QA bổ sung: **26/26 backend tests**, **4/4 browser tests**, sửa nút guest comment và kiểm tra XSS/rate/JWT/injection. Bảng đánh giá đầy đủ 46 mục: [QA_AUDIT](QA_AUDIT.md). Minh chứng Docker/Linux CI: [CI_EVIDENCE](CI_EVIDENCE.md). Không coi kết quả Linux là đã chạy Docker Desktop Windows.
