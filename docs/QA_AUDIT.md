# CookShare — kiểm toán chất lượng toàn bộ sản phẩm

Ngày kiểm toán: **15/10/2026**. Phạm vi: source React/Express, migrations/seed MySQL, UI, API, quyền, Docker/Nginx và monitoring. Đã trực tiếp sửa code, build và kiểm thử; không chỉ kiểm tra có file.

**Kết quả:** 26/26 tests backend local, 4/4 Playwright tests local; backend/browser CI và Docker stack CI cùng SUCCESS tại commit `c9b0b41`. Xem [minh chứng CI](CI_EVIDENCE.md), [verification](verification.md), [screenshots](screenshots/).

Quy ước: **DONE** đã triển khai và kiểm thử đạt; **PARTIAL** mới kiểm tra một phần; **NOT VERIFIED** chưa kiểm chứng. Dấu `—` là không áp dụng cho cột đó. Dữ liệu seed là dữ liệu mẫu được ghi vào MySQL thật, không phải mock thay API.

| STT | Chức năng | Frontend | Backend | Database | Kiểm thử | Trạng thái |
|---|---|---|---|---|---|---|
| 1 | Trang chủ, banner, navigation/footer | React responsive, nút có điều hướng | API món mới/popular/categories | recipes/categories/favorites | Browser + ảnh + API | DONE |
| 2 | Công thức mới/nổi bật/yêu thích | Card từ API, không số liệu giả | Sort theo created/likes/rating | Aggregate từ bảng tương tác | API/browser | DONE |
| 3 | Đăng ký | Form, validation, lỗi rõ | Không nhận role từ client, bcrypt | users unique email | Đúng/sai/trùng/role escalation | DONE |
| 4 | Đăng nhập | Modal, session token | JWT ký + issuer/audience/expiry | users/user_security | Đúng/sai/expired/wrong audience | DONE |
| 5 | Đăng xuất | UI xóa token sau API | Tăng token_version | user_security | Browser + token cũ 401 | DONE |
| 6 | Hồ sơ, tên và bio | Profile form | PUT /auth/me | users/user_profiles | Save/read API, browser | DONE |
| 7 | Upload avatar | Chọn ảnh, preview, lưu | Multer/Sharp | URL trong user_profiles, file trên volume | Browser upload + DB profile | DONE |
| 8 | Đổi mật khẩu | Kiểm tra xác nhận | Kiểm tra mật khẩu hiện tại, revoke | password_hash/token_version | API + đổi/login lại trên web | DONE |
| 9 | Phân quyền USER/ADMIN | Ẩn/hiện chức năng tương ứng | authenticate/admin đọc role DB | role/active | USER bị 403 API admin | DONE |
| 10 | Thêm recipe | Editor thật, dynamic ingredients/steps | POST transaction | recipes/children | Create → MySQL → trang chi tiết | DONE |
| 11 | Xem trước trước khi đăng | Preview giữ state; chưa tạo recipe | Chỉ lưu khi submit cuối | Không thêm recipe ở bước preview | Browser flow | DONE |
| 12 | Thêm nguyên liệu còn thiếu | Form inline | Member POST ingredient | ingredients unique | API quyền + browser lưu recipe | DONE |
| 13 | Sửa recipe | Editor nạp chi tiết | PUT, khóa row và owner/admin | Transaction thay children | Browser + rollback FK lỗi | DONE |
| 14 | Xóa recipe | Confirm modal, refresh list | DELETE owner/admin | Cascade children/interactions | Browser + FK/cascade | DONE |
| 15 | Upload ảnh món | File picker/preview/error | MIME + nội dung + pixel + size, re-encode | File WebP/UUID, URL trong recipe | Thật/giả/SVG/>5MB | DONE |
| 16 | Tìm theo tên | Debounced query | SQL bind parameters | recipes.title | API/browser + SQL injection string | DONE |
| 17 | Tìm theo nguyên liệu | Input kết hợp filters | EXISTS/JOIN | ingredients/recipe_ingredients | API/browser | DONE |
| 18 | Lọc category/difficulty/time | Tabs/selects | Query validation/AND conditions | recipes | Kết quả đã đối chiếu | DONE |
| 19 | Sort và pagination | Select, trang trước/sau | Whitelist, limit/offset/count | SQL order/tie-break id | API + browser chuyển trang | DONE |
| 20 | Chi tiết/tác giả/khẩu phần/steps | Trang chi tiết đầy đủ | GET detail, không lộ hidden cho public | JOIN users/categories/children | Browser + API | DONE |
| 21 | Checklist nguyên liệu | Checkbox dùng trong phiên nấu | — | Không yêu cầu lưu checklist | Browser click/tick | DONE |
| 22 | Favorites theo tài khoản | Toggle + trang đã lưu | PUT/DELETE idempotent | PK(user,recipe) | MySQL đếm không trùng; browser | DONE |
| 23 | Đánh giá 1–5 sao | Chọn sao, điểm thật | Validate/upsert/AVG | ratings unique(user,recipe) | Hai user → trung bình; browser | DONE |
| 24 | Bình luận thêm/sửa/xóa | Form, edit, confirm, pagination | Owner/admin enforcement | comments | API/browser CRUD | DONE |
| 25 | Khách bấm đăng nhập bình luận | Đã sửa nút bị validation chặn | Login API thật | users | Regression mở modal + Escape | DONE |
| 26 | Hồ sơ/bộ sưu tập/Bếp của tôi | Lists gọi API | /me/recipes, /me/saved | Author/favorites query | API + browser profile/mine | DONE |
| 27 | Công thức liên quan | Fetch cùng category, loại bản hiện tại | Recipe filter | recipes/category | Source/API/detail browser | DONE |
| 28 | Admin counts và biểu đồ | Sidebar/cards/chart từ API | Stats/30-day activity/distribution | SQL counts/group | API đối chiếu DB, browser | DONE |
| 29 | Quản lý user role/khóa | Table/filter/search/select | Admin guard, revoke, chặn tự khóa | users/user_security | Member403, lock→token401 | DONE |
| 30 | Admin quản lý recipe/moderation | Edit/delete/ẩn/hiện | Admin/owner + status | recipe_moderation | Public 404, owner thấy, UI toggle | DONE |
| 31 | Admin category/ingredient CRUD | Forms/table/confirm/search/pages | Role kiểm tra server | Unique/FK restrict | API + category CRUD browser | DONE |
| 32 | Admin quản lý comments | Table/search/pages/delete | Admin query + delete | comments | API + owner/admin checks | DONE |
| 33 | Loading/empty/error/toast/confirm | UI đã sử dụng thực tế | Status chuẩn, không success giả | Lỗi FK/unique có xử lý | Negative + browser flows | DONE |
| 34 | Responsive desktop/tablet/mobile | 1440/820/390px | — | — | Không tràn ngang, ảnh load; screenshots | DONE |
| 35 | MySQL/migration/seed | UI đọc seed qua API | Migrations ledger/lock + seed | 21 recipe, 6 category, FK/CHECK | Lặp migration/seed; MySQL 8.0 local/8.4 CI | DONE |
| 36 | Docker frontend/backend/DB | React build trong Docker | Non-root API, migration trước startup | Volume + bootstrap users | Linux CI build/start/seed pass | DONE |
| 37 | Nginx reverse proxy/security headers | HTML thật qua :8080 | /api,/uploads,/health proxy | API→DB ready | CI HTTP/headers, /metrics404 | DONE |
| 38 | phpMyAdmin service | HTTP login page thật | Container/PMA_HOST | MySQL cùng network | CI HTTP200; chưa thao tác GUI login/query | PARTIAL |
| 39 | Prometheus API/MySQL metrics | Grafana panels | /metrics + exporter | mysql_up/connections/query metrics | Portable + CI targets/samples | DONE |
| 40 | Container metrics cAdvisor | Dashboard có panels | cAdvisor scrape | Prometheus samples có nhãn CookShare | Docker CI query samples thật | DONE |
| 41 | Grafana dashboard/data sources | 11 panel, dữ liệu thật | Datasource health + provisioning | Grafana storage/Prometheus/Loki | Browser local + API/CI | DONE |
| 42 | Loki/Alloy Docker logs/LogQL | Grafana Explore/log panel | Docker discovery qua socket proxy | Loki chunks/index | 3 LogQL local + Docker ingestion CI | DONE |
| 43 | Hardening cơ bản | CSP/React escape | Auth/rate/payload/upload; API non-root | DDL runtime bị từ chối; secrets tách | Negative tests + hardening CI | DONE |
| 44 | GitHub/CI | — | Source và workflows đã push | — | Hai workflow SUCCESS, link minh chứng | DONE |
| 45 | Docker trên chính Windows này | — | CLI có, daemon chưa chạy | — | Đã dùng Linux CI thay thế | NOT VERIFIED |
| 46 | TLS/public deployment, restore/load test | Chưa triển khai public | Chưa có certificate/soak test | Chưa test restore backup | Không tuyên bố production certified | NOT VERIFIED |

## Lỗi phát hiện và đã sửa theo ưu tiên

| Mức | Lỗi | Cách sửa và kiểm chứng |
|---|---|---|
| P1 | Alloy thoát do không ghi được volume | Chạy UID/GID 473 đúng owner, giữ cap_drop; container validate và CI ingestion pass |
| P1 | Alloy Docker discovery bị 403 network metadata | Socket proxy chỉ thêm NETWORKS read; POST vẫn 0; log API đến Loki trong CI |
| P1 | Công cụ quản trị không truy cập được port publish khi chỉ dùng internal network | Bổ sung management bridge, vẫn bind loopback; CI phpMyAdmin/Prometheus/Grafana/Loki pass |
| P1 | API từng nhận mọi biến .env gồm mật khẩu root/migration | Tách environment theo service, seed service riêng; runtime CI chứng minh không có các secrets này |
| P2 | Nút “Đăng nhập để bình luận” của khách không phản hồi do required textarea | Button guest type=button, textarea disabled; browser regression pass |
| P2 | Thông báo lỗi community còn giữ sau lần thử mới | Xóa error khi bắt đầu rate/comment lại; build và hồi quy pass |
| P2 | Thu hồi token sau logout/đổi mật khẩu chưa có ở giai đoạn đầu | user_security token_version; API và browser chứng minh phiên cũ bị từ chối |
| P2 | Avatar/ảnh upload chưa có persistence ở giai đoạn đầu | Sharp/volume + URL MySQL; test upload và reload qua API |

## API, dữ liệu giả và nút bấm

Không phát hiện trang nghiệp vụ hiện tại dùng mock thay API hoặc API CRUD nghiệp vụ không kết nối MySQL. Trang chủ/danh sách/chi tiết/profile/editor/admin/community đều gọi `frontend/src/services/api.ts`. API sử dụng pool mysql2 và query/transaction; liveness, metrics và phục vụ file không phải CRUD DB nên không cần lưu MySQL.

Text banner, câu giới thiệu, icon và ảnh stock là nội dung trình bày tĩnh. Bộ dữ liệu seed lưu MySQL, có thể sửa/xóa và truy xuất bằng API; không render mảng recipe hardcode trong frontend. Không tìm thấy production mock/faker/Math.random/dangerouslySetInnerHTML/localStorage thay DB. Counters/ratings/admin charts đều từ query thật.

Đã thực thi các nhóm nút chính trong Playwright: navigation/search/filter/pages, mở detail, checkbox, account/login/register/profile/password/logout, upload, editor/preview/save/edit/delete, favorites/rating/comments và admin CRUD/moderation. Lỗi nút guest comment được phát hiện và sửa. Không khẳng định đã kiểm tra mọi tổ hợp dữ liệu/trình duyệt ngoài các kịch bản này.

## Bảo mật và phần chưa triển khai/kiểm chứng

Đã kiểm tra JWT expired/wrong audience, strict register không nhận role, password UTF-8 byte limit, rate limit, payload size, CORS/headers, SQL injection, owner/admin và XSS comment được render như text. Upload từ chối file giả/SVG/quá lớn. Dependency audit backend production báo 0 vulnerabilities; đây không phải kiểm toán bảo mật độc lập hoặc scan image toàn diện.

Chưa triển khai: email reset/verify, refresh token, quota/dọn upload mồ côi, gửi alert ra email/chat, public TLS. Đây là phần mở rộng/production vận hành, không có nút giả tuyên bố đã hoạt động. Chưa kiểm tra: đăng nhập/truy vấn tay bằng GUI phpMyAdmin, Docker Desktop Windows, backup restore, tải đồng thời/soak, Safari/Firefox và deployment Internet. Report PDF còn cần thông tin sinh viên ở bìa.

Không còn failure đã biết trong các test đã chạy. Chi tiết lệnh tái kiểm tra nằm trong README và DEPLOYMENT; không coi kết quả Linux CI là đã chạy Docker trên Windows local.
