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
| Git source, ignore secrets/artifacts, CI workflows | PARTIAL | Source/workflows đã chuẩn bị; xem Git log/verification cho trạng thái đồng bộ remote và CI |
| Docker Compose và Dockerfiles | PARTIAL | Compose config pass; chưa build/run image trên máy này |
| Nginx reverse proxy và frontend static | PARTIAL | Có cấu hình và Dockerfile; chưa kiểm thử Nginx container thực tế |
| phpMyAdmin | NOT VERIFIED | Có profile tools, chưa chạy container |
| Prometheus API và MySQL metrics | DONE | Portable thực chạy: up API/MySQL=1, mysql_up=1, có HTTP/DB samples |
| Grafana datasource/dashboard 11 panel | DONE | Portable, datasource health OK; browser screenshot/dashboard API pass |
| Loki + Alloy thu log và ≥3 LogQL | DONE | Portable file tail → Loki, 3 query trả success/log thật |
| Docker log discovery qua socket proxy | NOT VERIFIED | Alloy validate pass; cần Docker để xác minh luồng container |
| cAdvisor CPU/memory container | NOT VERIFIED | Có scrape/dashboard; máy chưa có Docker daemon chạy |
| Hardening runtime toàn bộ Docker | PARTIAL | Code/config tách DB users, non-root, networks, cap drops, read-only; cần runtime Docker để xác minh |
| HTTPS public | NOT VERIFIED | Không cấp chứng chỉ hoặc deploy Internet; có security headers theo đề |
| Báo cáo 10 trang và minh chứng | PARTIAL | PDF đúng 10 trang, không tràn, ảnh thật; cần điền tên/MSSV/lớp trước khi nộp |

Không có lỗi test tồn đọng tại thời điểm ghi nhận. Không coi cấu hình hoặc workflow chưa chạy là runtime DONE. Hướng dẫn kiểm tra phần Docker còn thiếu: `docs/DEPLOYMENT.md` và `scripts/verify-stack.mjs`.
