export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = sessionStorage.getItem("cookshare-token");
  const response = await fetch("/api/v1" + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json();
  if (response.status === 401 && token) {
    sessionStorage.removeItem("cookshare-token");
    window.dispatchEvent(new Event("session-expired"));
  }
  if (!response.ok)
    throw Error(
      body?.error === "Invalid email or password"
        ? "Email hoặc mật khẩu chưa đúng."
        : body?.error === "Resource already exists"
          ? "Dữ liệu này đã tồn tại."
          : body?.error === "Validation failed"
            ? "Thông tin chưa hợp lệ. Kiểm tra độ dài, kiểu dữ liệu và các trường bắt buộc."
            : body?.error || "Không thể kết nối. Vui lòng thử lại.",
    );
  return body;
}
export async function uploadImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Chỉ nhận ảnh JPEG, PNG, WebP.");
  if (file.size > 5 * 1024 * 1024) throw Error("Ảnh tối đa 5 MB.");
  const body = new FormData();
  body.append("image", file);
  const response = await fetch("/api/v1/uploads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionStorage.getItem("cookshare-token")}`,
    },
    body,
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Không tải được ảnh.");
  return data.data.url as string;
}
