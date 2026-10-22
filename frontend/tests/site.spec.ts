import { randomBytes } from "node:crypto";
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
const image = fileURLToPath(
  new URL("../public/images/salad.jpg", import.meta.url),
);
test("public website, filters and desktop/tablet/mobile layouts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Chuyện ngon bắt đầu từ bếp." }),
  ).toBeVisible();
  await expect(page.locator(".recipe-card")).toHaveCount(9);
  for (const [width, height, label] of [
    [1440, 1000, "desktop"],
    [820, 1100, "tablet"],
    [390, 844, "mobile"],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const img of await page.locator("img").all()) {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          img.evaluate(
            (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
          ),
        )
        .toBe(true);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `test-results/home-${label}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator("img")
        .evaluateAll((images) =>
          images.every((img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0),
        ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Khám phá công thức", exact: true })
    .click();
  await expect(page.locator(".listing-grid .recipe-card")).toHaveCount(9);
  await page
    .getByRole("textbox", { name: "Tên món ăn", exact: true })
    .fill("Salad");
  await expect(page.locator(".result-count")).toContainText("24 công thức");
  await page
    .getByRole("textbox", { name: "Tìm theo nguyên liệu" })
    .fill("Cà chua");
  await page.getByLabel("Thời gian", { exact: true }).selectOption("15");
  await page.getByLabel("Độ khó", { exact: true }).selectOption("easy");
  await expect(page.locator(".recipe-card")).toHaveCount(4);
  await page.getByRole("textbox", { name: "Tên món ăn", exact: true }).fill("");
  await page.getByRole("textbox", { name: "Tìm theo nguyên liệu" }).fill("");
  await page.getByLabel("Thời gian", { exact: true }).selectOption("");
  await page.getByLabel("Độ khó", { exact: true }).selectOption("");
  await expect(page.getByRole("button", { name: "Trang sau" })).toBeVisible();
  await page.getByRole("button", { name: "Trang sau" }).click();
  await expect(page.locator(".pagination")).toContainText("Trang 2");
  await page.locator(".card-title").first().click();
  await expect(page.locator(".ingredient-list button").first()).toBeVisible();
  await page.locator(".ingredient-list button").first().click();
  await expect(page.locator(".ingredient-list .checked")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Đăng nhập để bình luận", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/recipe-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/recipe-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("account, profile, upload, create-preview-edit-delete, favorite, rating and comments", async ({
  page,
}) => {
  const password = randomBytes(24).toString("hex");
  const changedPassword = randomBytes(24).toString("hex");
  const title = `Món thử giao diện ${Date.now()}`,
    email = `browser${Date.now()}@test.local`;
  await page.goto("/");
  await page.getByLabel("Tài khoản", { exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Email hoặc mật khẩu");
  await page.getByRole("button", { name: "Đăng ký ngay" }).click();
  await page.getByLabel("Tên của bạn").fill("Đầu bếp kiểm thử");
  const loginRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/auth/login"))
      loginRequests.push(request.url());
  });
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Tạo tài khoản thành công",
  );
  await expect(page.getByLabel("Tên của bạn")).toHaveCount(0);
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
  await expect(page.getByLabel("Mật khẩu", { exact: true })).toHaveValue("");
  expect(loginRequests).toHaveLength(0);
  expect(
    await page.evaluate(() => sessionStorage.getItem("cookshare-token")),
  ).toBeNull();
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Tài khoản", { exact: true }).click();
  await page.getByLabel("Tên hiển thị").fill("Bếp thử đã cập nhật");
  await page
    .getByLabel("Đôi lời về bạn")
    .fill("Yêu món Việt và những căn bếp ấm.");
  await page.locator(".avatar-upload input").setInputFiles(image);
  await expect(page.locator(".profile-avatar img")).toBeVisible();
  await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu hồ sơ");
  await page.getByRole("button", { name: "Bếp của tôi", exact: true }).click();
  await page
    .getByRole("button", { name: "Thêm công thức", exact: true })
    .click();
  await page.getByLabel("Tên món ăn", { exact: true }).fill(title);
  await page
    .getByLabel("Mô tả", { exact: true })
    .fill("Món ăn kiểm thử tạo thật trong MySQL từ giao diện.");
  await page.locator(".upload-control input").setInputFiles(image);
  await expect(page.locator(".upload-preview")).toBeVisible();
  await page
    .getByLabel("Nguyên liệu 1", { exact: true })
    .selectOption({ index: 1 });
  await page
    .getByLabel("Tên nguyên liệu mới")
    .fill(`Nguyên liệu từ UI ${Date.now()}`);
  await page
    .getByRole("button", { name: "Thêm nguyên liệu mới", exact: true })
    .click();
  await expect(page.getByLabel("Nguyên liệu 2", { exact: true })).toHaveValue(
    /^[1-9][0-9]*$/,
  );
  await page
    .getByPlaceholder("Mô tả bước 1")
    .fill("Rửa sạch nguyên liệu, nấu chín và dùng nóng.");
  await page
    .getByRole("button", { name: "Xem trước công thức", exact: true })
    .click();
  await expect(page.locator(".editor-preview h2")).toHaveText(title);
  await page
    .getByRole("button", { name: "Đăng công thức", exact: true })
    .click();
  await expect(page.locator(".detail-hero h1")).toHaveText(title);
  await page
    .getByRole("button", { name: "Lưu công thức", exact: true })
    .click();
  await expect(page.locator(".detail-rating")).toContainText(
    "1 lượt yêu thích",
  );
  await page
    .getByRole("button", { name: "Đánh giá 5 sao", exact: true })
    .click();
  await expect(page.locator(".detail-rating")).toContainText("5.0");
  await page
    .getByRole("textbox", { name: "Bình luận của bạn" })
    .fill('<img src=x onerror="window.cookshareXss=true">');
  await page
    .getByRole("button", { name: "Gửi bình luận", exact: true })
    .click();
  await expect(page.locator(".comment>p")).toHaveText(
    '<img src=x onerror="window.cookshareXss=true">',
  );
  await expect(page.locator(".comment>p img")).toHaveCount(0);
  await page
    .locator(".comment-actions")
    .getByRole("button", { name: "Sửa", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Sửa bình luận" })
    .fill("Bổ sung một ít rau sẽ ngon hơn.");
  await page
    .getByRole("button", { name: "Lưu bình luận", exact: true })
    .click();
  await expect(page.locator(".comment>p")).toHaveText(
    "Bổ sung một ít rau sẽ ngon hơn.",
  );
  await page
    .locator(".comment-actions")
    .getByRole("button", { name: "Xóa", exact: true })
    .click();
  await page.getByRole("button", { name: "Xác nhận xóa", exact: true }).click();
  await expect(page.locator(".comment")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Chỉnh sửa công thức", exact: true })
    .click();
  await page.getByLabel("Tên món ăn", { exact: true }).fill(title + " đã sửa");
  await page
    .getByRole("button", { name: "Xem trước công thức", exact: true })
    .click();
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.locator(".detail-hero h1")).toHaveText(title + " đã sửa");
  await page
    .getByRole("button", { name: "Xóa công thức", exact: true })
    .click();
  await page.getByRole("button", { name: "Xác nhận xóa", exact: true }).click();
  await expect(page.locator(".listing-hero h1")).toContainText(
    "Công thức của tôi.",
  );
  await expect(page.locator(".recipe-card")).toHaveCount(0);
  await page.getByLabel("Tài khoản", { exact: true }).click();
  await page
    .getByLabel("Mật khẩu hiện tại", { exact: true })
    .fill(password);
  await page
    .getByLabel("Mật khẩu mới", { exact: true })
    .fill(changedPassword);
  await page
    .getByLabel("Xác nhận mật khẩu mới", { exact: true })
    .fill(changedPassword);
  await page
    .getByRole("button", { name: "Cập nhật mật khẩu", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Bếp của tôi", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Tài khoản", { exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(changedPassword);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Tài khoản", { exact: true }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page
    .getByRole("button", { name: /Đăng xuất khỏi mọi thiết bị/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Xác nhận đăng xuất?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Bếp của tôi", exact: true }),
  ).toBeVisible();
  const otherLogin = await page.request.post("/api/v1/auth/login", {
    data: { email, password: changedPassword },
  });
  expect(otherLogin.ok()).toBe(true);
  const otherToken = (await otherLogin.json()).data.access_token;
  const otherHeaders = { Authorization: `Bearer ${otherToken}` };
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page
    .getByRole("button", { name: /Đăng xuất khỏi thiết bị này/ })
    .click();
  await page
    .getByRole("button", { name: "Xác nhận đăng xuất", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Bếp của tôi", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => sessionStorage.getItem("cookshare-token")),
  ).toBeNull();
  expect(
    (
      await page.request.get("/api/v1/auth/me", { headers: otherHeaders })
    ).status(),
  ).toBe(200);
  await page.getByLabel("Tài khoản", { exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(changedPassword);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Tài khoản", { exact: true }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page
    .getByRole("button", { name: /Đăng xuất khỏi mọi thiết bị/ })
    .click();
  await page
    .getByRole("button", { name: "Xác nhận đăng xuất", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Bếp của tôi", exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await page.request.get("/api/v1/auth/me", { headers: otherHeaders })
    ).status(),
  ).toBe(401);
});
test("admin dashboard, categories, moderation and user access controls", async ({
  page,
}) => {
  test.skip(!process.env.E2E_ADMIN_PASSWORD, "Set E2E_ADMIN_PASSWORD");
  await page.goto("/");
  await page.getByLabel("Tài khoản", { exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("admin@cookshare.local");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByRole("button", { name: "Quản trị", exact: true }).click();
  await expect(page.locator(".stat-card")).toHaveCount(4);
  await expect(page.locator(".stat-card").nth(1)).toContainText("141");
  await page.screenshot({
    path: "test-results/admin-desktop.png",
    fullPage: true,
  });
  await page
    .locator(".admin-sidebar")
    .getByRole("button", { name: "Danh mục", exact: true })
    .click();
  await page.getByRole("button", { name: "+ Thêm mới", exact: true }).click();
  const name = `Danh mục thử ${Date.now()}`;
  await page.getByLabel("Tên", { exact: true }).fill(name);
  await page
    .getByLabel("Mô tả", { exact: true })
    .fill("Danh mục từ trình duyệt");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await page.getByPlaceholder("Tìm trong danh sách…").fill(name);
  await expect(page.locator("tbody tr")).toContainText(name);
  await page.getByRole("button", { name: `Sửa ${name}`, exact: true }).click();
  await page.getByLabel("Tên", { exact: true }).fill(name + " mới");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.locator("tbody tr")).toContainText(name + " mới");
  await page
    .getByRole("button", { name: `Xóa ${name} mới`, exact: true })
    .click();
  await page.getByRole("button", { name: "Xác nhận xóa", exact: true }).click();
  await expect(page.locator("tbody")).toContainText("Không có kết quả");
  await page
    .locator(".admin-sidebar")
    .getByRole("button", { name: "Công thức", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(10);
  const row = page.locator("tbody tr").first();
  await row.getByRole("button", { name: /Kiểm duyệt/ }).click();
  await expect(row).toContainText("Đã ẩn");
  await row.getByRole("button", { name: /Kiểm duyệt/ }).click();
  await expect(row).toContainText("Đang hiển thị");
  await page
    .locator(".admin-sidebar")
    .getByRole("button", { name: "Người dùng", exact: true })
    .click();
  await expect(page.locator("tbody")).not.toContainText("Đang tải dữ liệu");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/admin-mobile.png",
    fullPage: true,
  });
});
