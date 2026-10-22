import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("visual system, keyboard dialogs, search and responsive navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".recipe-card")).toHaveCount(9);
  await page.evaluate(() =>
    Promise.all([
      document.fonts.load("16px Manrope"),
      document.fonts.load("24px Lora"),
    ]),
  );
  expect(
    await page.evaluate(
      () =>
        document.fonts.check("16px Manrope") &&
        document.fonts.check("24px Lora"),
    ),
  ).toBe(true);
  const audit = async () => {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  };
  await audit();
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.getByLabel("Tài khoản", { exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await audit();
  await page.screenshot({ path: "test-results/auth-desktop.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Tài khoản", { exact: true })).toBeFocused();
  await page.getByLabel("Bạn muốn nấu món gì?").fill("Salad");
  await page.getByRole("button", { name: "Tìm món ngon", exact: true }).click();
  await expect(page.locator(".result-count")).toContainText("24 công thức");
  await audit();
  for (const width of [360, 390, 600, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("navigation", { name: "Điều hướng chính" })
    .getByRole("button", { name: "Trang chủ", exact: true })
    .click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await audit();
  await page.getByLabel("Tài khoản", { exact: true }).click();
  await audit();
  const dialogBounds = await page.getByRole("dialog").boundingBox();
  expect(dialogBounds!.x).toBeGreaterThanOrEqual(16);
  expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(374);
  await expect(
    page.getByRole("button", { name: "Đóng", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "test-results/auth-mobile.png" });
});

test("detail, profile, editor and admin accessibility and adaptive layouts", async ({
  page,
}) => {
  test.skip(!process.env.E2E_ADMIN_PASSWORD, "Set E2E_ADMIN_PASSWORD");
  const inspect = async (label: string) => {
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${label} overflow at ${width}`,
      ).toBe(true);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        `${label} at ${width}`,
      ).toEqual([]);
      await page.screenshot({
        path: `test-results/ui-${label}-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  };
  await page.goto("/");
  await page.locator(".card-title").first().click();
  await expect(page.locator(".ingredient-list button").first()).toBeVisible();
  await inspect("detail");
  await page.getByLabel("Tài khoản", { exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("admin@cookshare.local");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Tài khoản", { exact: true }).click();
  await expect(page.getByLabel("Tên hiển thị")).toBeVisible();
  await inspect("profile");
  await page
    .getByRole("button", { name: "Chia sẻ công thức", exact: true })
    .click();
  await expect(page.getByLabel("Tên món ăn", { exact: true })).toBeVisible();
  await inspect("editor");
  await page.getByRole("button", { name: "Quản trị", exact: true }).click();
  await expect(page.locator(".stat-card")).toHaveCount(4);
  await inspect("dashboard");
  await page
    .locator(".admin-sidebar")
    .getByRole("button", { name: "Công thức", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(10);
  await inspect("admin-table");
});
