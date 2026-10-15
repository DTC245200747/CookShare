# CookShare — nâng cấp UI/UX

Ngày kiểm tra: 15/10/2026. Website local: http://localhost:3000/.

## Phạm vi thay đổi

- Hệ thống màu kem, olive, cam đất; font Manrope và Lora được phục vụ tại chỗ, kèm giấy phép SIL OFL. Không cần gọi Google Fonts khi người dùng mở website.
- Trang chủ có hero ảnh lớn, ô tìm kiếm hoạt động, thống kê lấy từ API; card món ăn có tác giả, thời gian, đánh giá và nút lưu.
- Danh sách/tìm kiếm/danh mục có bộ lọc, chip trạng thái và phân trang thống nhất.
- Chi tiết công thức có ảnh, thông số món ăn, checklist nguyên liệu, từng bước nấu và khu vực cộng đồng rõ ràng.
- Đăng nhập/đăng ký dùng bố cục hai cột trên desktop, một cột trên mobile. Hồ sơ có banner cá nhân, form, ảnh đại diện và bộ sưu tập.
- Dashboard có sidebar olive, thẻ thống kê, biểu đồ từ dữ liệu API và bảng quản trị có vùng cuộn riêng trên màn hình nhỏ.
- Loading skeleton, toast, empty state, thông báo lỗi, trạng thái disabled và chuyển động hover được thống nhất.
- Thêm skip link, focus rõ ràng, giữ focus trong hộp thoại, Escape để đóng, trả focus về nút mở, khóa cuộn nền và hỗ trợ reduced motion. Menu mobile có aria-expanded; nút yêu thích có aria-pressed.

Không sửa backend, API, schema hoặc dữ liệu seed trong đợt nâng cấp này. Các bài kiểm thử nghiệp vụ tạo/sửa/xóa dữ liệu thử qua API thật như trước.

## Kiểm chứng

| Nhóm | Kết quả kiểm tra |
| --- | --- |
| Build production | TypeScript và Vite build thành công |
| Nghiệp vụ trình duyệt | Tìm kiếm, bộ lọc, phân trang, checklist; đăng ký/đăng nhập; hồ sơ/ảnh; CRUD và preview công thức; yêu thích/đánh giá/bình luận; CRUD danh mục, kiểm duyệt và quyền người dùng |
| Responsive | Trang chủ/danh sách tại 360, 390, 600, 768, 820, 1024, 1440px theo từng bài test; chi tiết, hồ sơ, editor, dashboard và bảng quản trị tại 390/768/1440px; kiểm tra không tràn chiều ngang |
| Accessibility tự động | axe-core với WCAG 2 A/AA và 2.1 AA trên trang chủ, đăng nhập, danh sách, chi tiết, hồ sơ, editor, dashboard, bảng quản trị; không có vi phạm được phát hiện trong các trạng thái đã kiểm tra |
| Bàn phím | Skip link, Tab giữ trong dialog, Escape, focus trở lại nút mở, menu mobile và tìm kiếm hero |
| Font/ảnh | Kiểm tra font local tải được; ảnh trang chủ tải thành công; xem ảnh chụp desktop và mobile để phát hiện clipping |
| Giám sát hồi quy | Bài test Grafana/datasource Prometheus/Loki hiện có vẫn chạy |

Hai bài test UI mới nằm ở `frontend/tests/ui.spec.ts`; tổng bộ Playwright hiện có **6 bài** khi bật tài khoản admin và Grafana local. Ảnh kiểm chứng tại [screenshots/ui-upgrade](screenshots/ui-upgrade/).

Để chạy trên website local đang hoạt động, trong thư mục `frontend`:

```powershell
npm ci
npm run build
$env:E2E_CHROME='1' # Dùng Chrome đã cài; bỏ biến này nếu dùng Chromium của Playwright
$env:E2E_ADMIN_PASSWORD='<mật khẩu admin của môi trường kiểm thử>'
$env:E2E_GRAFANA_URL='http://localhost:3001'
$env:E2E_GRAFANA_PASSWORD='<mật khẩu Grafana kiểm thử>'
npx playwright test
```

CI hiện có tự cài Chromium và chạy các bài UI mới cùng bộ hồi quy. Không đặt mật khẩu production trong lệnh, ảnh hoặc tài liệu.

## Giới hạn

Kiểm tra trình duyệt được thực hiện bằng Chrome trên Windows và viewport mô phỏng. Chưa kiểm chứng trên thiết bị iOS/Android thật, Safari, Firefox hoặc bằng trình đọc màn hình thực tế. axe-core không thay thế đánh giá accessibility thủ công đầy đủ. Ảnh món ăn hiện có được giữ nguyên; một số công thức seed vẫn dùng chung ảnh minh họa. Không tuyên bố đã kiểm thử tải, thanh toán hoặc nghiệp vụ thương mại ngoài phạm vi dự án hiện tại.
