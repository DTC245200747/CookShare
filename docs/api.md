# CookShare REST API

Prefix `/api/v1`. JSON `{data: ...}`; lists paginées `{data: [], pagination: {page,limit,total}}`; lỗi `{error: "...", details?: ...}`. Auth dùng `Authorization: Bearer <access_token>`. Frontend lưu token ở sessionStorage. API không dùng auth cookie.

## Tài khoản

| Method | Path | Payload / kết quả |
|---|---|---|
| POST | /auth/register | `{name,email,password}` → user member, 201 |
| POST | /auth/login | `{email,password}` → `{user,access_token,token_type,expires_in}` |
| GET | /auth/me | User đang đăng nhập, bio/avatar |
| PUT | /auth/me | `{name,bio,avatar_url?}`; không nhận role/email |
| PUT | /auth/password | `{current_password,password}`; thành công 204, thu hồi phiên cũ |
| POST | /auth/logout | 204; thu hồi toàn bộ token trước đó của user |

Mật khẩu ít nhất 10 ký tự và tối đa 72 byte UTF-8; email chuẩn hóa lowercase. Token HS256, issuer `cookshare`, audience `cookshare-api`, expires 1 giờ. User/role/active/token_version kiểm tra lại từ MySQL ở mỗi request. Khóa tài khoản hoặc đổi quyền cũng thu hồi phiên cũ.

## Công thức

| Method | Path | Quyền |
|---|---|---|
| GET | /recipes | Public; chỉ công thức published |
| GET | /recipes/:id | Public; hidden chỉ owner/admin có token |
| POST | /recipes | Member/admin |
| PUT, DELETE | /recipes/:id | Owner/admin |
| GET | /me/recipes | Đăng nhập; cả published và hidden của mình |
| GET | /me/saved | Đăng nhập; công thức đã lưu và còn published |

Query danh sách: `page=1`, `limit=12` (1–100), `q` tên món, `ingredient` tên nguyên liệu, `category_id`, `author_id`, `difficulty=easy|medium|hard`, `max_minutes` tổng thời gian, `sort=newest|popular|rating`. Các bộ lọc kết hợp AND. SQL order chỉ dùng whitelist. Phân trang có tie-breaker id.

Payload tạo/cập nhật (PUT thay thế đầy đủ):

```json
{
  "title": "Taco bò",
  "description": "Bữa tối dễ làm",
  "category_id": 1,
  "image_url": "/uploads/123e4567-e89b-12d3-a456-426614174000.webp",
  "prep_minutes": 15,
  "cook_minutes": 10,
  "servings": 4,
  "difficulty": "easy",
  "ingredients": [{"ingredient_id": 1, "quantity": 500, "unit": "g"}],
  "steps": ["Sơ chế nguyên liệu", "Nấu chín và trình bày"]
}
```

ID lấy từ DB thực tế. image_url tùy chọn/null, nhận URL http(s), đường dẫn ảnh seed `/images/*.jpg`, hoặc UUID WebP từ upload. Quantity dương, tối đa 3 số thập phân; không lặp ingredient_id. 1–100 nguyên liệu, 1–100 bước. Không nhận author_id/role/status từ client. Cập nhật recipe và thay toàn bộ children trong transaction; khóa hàng để kiểm tra owner. Chi tiết trả thêm author/category, nguyên liệu có tên, steps có position/instruction, favorite_count, average_rating, rating_count và status.

## Taxonomy và upload

| Method | Path | Quyền |
|---|---|---|
| GET | /categories, /ingredients | Public, sắp tên |
| GET | /categories/:id, /ingredients/:id | Public |
| POST | /categories | Admin |
| POST | /ingredients | Member/admin, để thêm nguyên liệu còn thiếu |
| PUT, DELETE | /categories/:id, /ingredients/:id | Admin |
| POST | /uploads | Đăng nhập, multipart field `image` |

Taxonomy payload `{name,description?}`; name unique, description null/optional. FK bảo vệ mục đã dùng. Upload 1 ảnh JPEG/PNG/WebP, tối đa 5 MB, kiểm tra nội dung/pixel, bỏ metadata bằng re-encode WebP, trả `{data:{url:"/uploads/<uuid>.webp"}}`. Không dùng JSON cho upload. File lưu ổ đĩa/volume, URL lưu trong recipe/profile.

## Cộng đồng

| Method | Path | Hành vi |
|---|---|---|
| GET | /me/favorites | Đăng nhập; danh sách recipe_id đã lưu |
| GET | /recipes/:id/interactions | Đăng nhập; `{favorite,rating}` của mình |
| PUT, DELETE | /recipes/:id/favorite | Đăng nhập; lưu/bỏ lưu, idempotent |
| PUT | /recipes/:id/rating | Đăng nhập; `{score:1..5}`, upsert một đánh giá/user/recipe |
| GET | /recipes/:id/comments | Public, `page`, `limit` (mặc định 10) |
| POST | /recipes/:id/comments | Đăng nhập; `{content}` 1–2000 ký tự |
| PUT | /comments/:id | Chỉ chủ bình luận; `{content}` |
| DELETE | /comments/:id | Chủ bình luận/admin |

Không cho tương tác mới với recipe hidden. Bình luận không giới hạn một bình luận/user vì đây là hội thoại; bản trùng favorite/rating bị chặn bằng primary key `(user_id,recipe_id)`. Điểm trung bình/lượt thích được tính từ DB, không cộng giả ở frontend.

## Admin (mọi endpoint kiểm tra authenticate + admin)

| Method | Path | Payload / kết quả |
|---|---|---|
| GET | /admin/stats | users/recipes/categories/comments/favorites, activity 30 ngày, distribution |
| GET | /admin/users | page/limit/q/status=all\|active\|disabled |
| PATCH | /admin/users/:id | `{role:"member"\|"admin",active:boolean}` |
| GET | /admin/recipes | page/limit/q/status=all\|published\|hidden |
| PATCH | /admin/recipes/:id/status | `{status:"published"\|"hidden"}` |
| GET | /admin/comments | page/limit/q |

Admin sử dụng endpoint CRUD recipes/taxonomy/comments ở trên. Không cho admin tự hạ quyền/khóa chính mình. Khóa user giữ dữ liệu/tác giả để bảo toàn lịch sử; không có xóa tài khoản hàng loạt.

## Health, metrics và status

`/health/live`: process; `/health/ready`: MySQL `SELECT 1`, lỗi 503. `/metrics`: Prometheus nội bộ, Nginx chặn public.

400 validation/JSON/upload không hợp lệ; 401 auth sai/hết hạn/thu hồi; 403 thiếu quyền; 404 không tồn tại hoặc tài nguyên không được phép thấy; 409 trùng dữ liệu/FK; 413 payload/ảnh quá lớn; 429 rate limit; 500 server lỗi, không lộ SQL. Bình luận không phải của mình trả 404 để không xác nhận tài nguyên private.

## Ví dụ PowerShell

```powershell
$base='http://localhost:3000/api/v1'
$login=Invoke-RestMethod "$base/auth/login" -Method Post -ContentType 'application/json' -Body (@{email='admin@cookshare.local';password='your-admin-password'} | ConvertTo-Json)
$headers=@{Authorization="Bearer $($login.data.access_token)"}
Invoke-RestMethod "$base/auth/me" -Headers $headers
Invoke-RestMethod "$base/recipes?ingredient=ca%20chua&max_minutes=30&sort=rating"
Invoke-RestMethod "$base/me/saved" -Headers $headers
# Lưu payload đã sửa ID thành recipe.json UTF-8
$recipe=Invoke-RestMethod "$base/recipes" -Method Post -Headers $headers -ContentType 'application/json' -InFile recipe.json
Invoke-RestMethod "$base/recipes/$($recipe.data.id)/favorite" -Method Put -Headers $headers
Invoke-RestMethod "$base/recipes/$($recipe.data.id)" -Method Delete -Headers $headers
```
