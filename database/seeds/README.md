Seed chạy bằng `cd backend && npm run db:seed`, sử dụng bcrypt và transaction trong `backend/src/config/seed.ts`. Phải đặt SEED_ADMIN_PASSWORD. Chạy lại không nhân đôi dữ liệu mẫu, không đổi mật khẩu tài khoản cũ.

`recipes.json` giữ 20 món mẫu ban đầu; `recipes-extra.json` bổ sung **120 món mới**, đúng 20 món cho mỗi danh mục Bữa sáng, Đồ uống, Món chay, Món chính, Salad và Tráng miệng. Cộng món Taco bò được khởi tạo riêng, bộ seed có **141 công thức**. Không xóa hoặc ghi đè món cũ.

Mỗi món mới có định lượng, khẩu phần, thời gian và ba bước thực hiện riêng. Thời gian ngâm, nghỉ, làm lạnh hoặc cấp đông được nêu trong hướng dẫn; ảnh dùng chung từ bộ ảnh minh họa local, chưa phải ảnh riêng cho từng món.

Kiểm tra cấu trúc: `cd backend && npx vitest run tests/catalog.test.ts`. Sau khi chạy seed và mở web, từ thư mục gốc chạy `node scripts/verify-catalog.mjs` để kiểm tra đủ 120 món cùng nguyên liệu, thời gian, các bước qua REST API kết nối MySQL. Có thể đặt `BASE_URL` nếu dùng cổng khác.
