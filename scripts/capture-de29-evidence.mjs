// Screenshots of real browser pages, without overlays or generated mockups.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const require = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const folder = new URL("../docs/report-evidence/", import.meta.url);
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.E2E_CHROME === "1" ? "chrome" : undefined,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const captures = [
  ["prometheus-targets-native.png", "http://localhost:9090/targets"],
  ["api-metrics-native.png", "http://localhost:3000/metrics"],
  ["alloy-native.png", "http://localhost:12345/"],
];
for (const [i, query] of [
  '{job="cookshare",service="api"}',
  '{job="cookshare",service="api"} | json | __error__="" | status >= 400',
  'sum by(status)(count_over_time({job="cookshare",service="api"} | json | __error__="" [5m]))',
].entries())
  captures.push([
    `logql-${i + 1}-native.png`,
    `http://localhost:3100/loki/api/v1/${i === 2 ? "query" : "query_range"}?query=${encodeURIComponent(query)}${i === 2 ? "" : "&limit=3"}`,
  ]);
const results = [];
try {
  for (const [name, url] of captures) {
    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      if (!response?.ok()) throw Error(`HTTP ${response?.status()}`);
      if (url.includes("/targets"))
        await page
          .getByText("cookshare-api", { exact: false })
          .first()
          .waitFor();
      await page.screenshot({
        path: fileURLToPath(new URL(name, folder)),
        fullPage: true,
      });
      results.push({
        name,
        url,
        status: "captured",
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      results.push({ name, url, status: "NOT VERIFIED", reason: e.message });
    }
  }
} finally {
  await browser.close();
}
await writeFile(
  new URL("capture-manifest.json", folder),
  JSON.stringify(
    { mode: "native-windows-supplemental", captures: results },
    null,
    2,
  ) + "\n",
);
console.log(results.map((r) => `${r.status}: ${r.name}`).join("\n"));
