import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const require = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const backendRequire = createRequire(
  new URL("../backend/package.json", import.meta.url),
);
const { chromium, expect } = require("@playwright/test");
const settings = backendRequire("dotenv").parse(
  await readFile(new URL("../backend/.env", import.meta.url)),
);
const state = JSON.parse(
  await readFile(
    new URL("../docs/report-evidence/data-sync-staging.json", import.meta.url),
    "utf8",
  ),
);
const target = process.env.SYNC_VERIFY_URL || state.stagingUrl;
assert.ok([state.stagingUrl, "http://localhost:8080"].includes(target));
const production = target === "http://localhost:8080";
const prefix = production ? "data-sync-production" : "data-sync-preview";
const browser = await chromium.launch({
  channel: process.env.E2E_CHROME === "1" ? "chrome" : undefined,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const evidence = new URL("../docs/report-evidence/", import.meta.url);
try {
  await page.goto(target);
  await expect(page.locator(".recipe-card")).toHaveCount(9);
  for (const img of await page.locator("img").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0))
      .toBe(true);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: fileURLToPath(new URL(prefix + "-home.png", evidence)),
    fullPage: true,
  });
  const title = await page.locator(".card-title").first().innerText();
  await page.locator(".card-title").first().click();
  await expect(page.locator(".detail-hero h1")).toHaveText(title);
  await expect(page.locator(".ingredient-list button").first()).toBeVisible();
  await expect(page.locator(".step").first()).toBeVisible();
  const image = page.locator(".detail-hero>img");
  await expect
    .poll(() => image.evaluate((el) => el.complete && el.naturalWidth > 0))
    .toBe(true);
  await page.screenshot({
    path: fileURLToPath(new URL(prefix + "-detail.png", evidence)),
    fullPage: true,
  });
  await page.getByLabel("Tài khoản", { exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("admin@cookshare.local");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(settings.SEED_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Quản trị", exact: true }).click();
  await expect(page.locator(".stat-card")).toHaveCount(4);
  await expect(page.locator(".stat-card").nth(0)).toContainText("17");
  await expect(page.locator(".stat-card").nth(1)).toContainText("141");
  await page.screenshot({
    path: fileURLToPath(new URL(prefix + "-admin.png", evidence)),
    fullPage: true,
  });
  assert.equal(errors.length, 0, "Browser JavaScript errors");
  const counts = {};
  for (const port of [3000, 8080, 18080]) {
    const response = await fetch(
      `http://localhost:${port}/api/v1/recipes?limit=1`,
    );
    assert.equal(response.status, 200);
    counts[port] = (await response.json()).pagination.total;
  }
  assert.deepEqual(counts, { 3000: 141, 8080: production ? 141 : 0, 18080: 141 });
  const report = {
    timestamp: new Date().toISOString(),
    url: target,
    homepage: true,
    recipeDetail: true,
    imagesLoaded: true,
    login: true,
    adminStats: { users: 17, recipes: 141 },
    javascriptErrors: errors,
    productionVerified: production,
    recipeCounts: counts,
  };
  await writeFile(
    new URL(prefix + "-browser.json", evidence),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `Browser checks passed at ${target}: homepage, detail, images, login and admin stats.`,
  );
} finally {
  await browser.close();
}
