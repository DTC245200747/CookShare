// Supplemental native Windows evidence. This does not certify Docker/Nginx/cAdvisor.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../backend/package.json", import.meta.url),
);
require("dotenv").config({ path: new URL("../backend/.env", import.meta.url) });
const mysql = require("mysql2/promise");
const folder = new URL("../docs/report-evidence/", import.meta.url);
await mkdir(folder, { recursive: true });
const result = {
  timestamp: new Date().toISOString(),
  mode: "native-windows-supplemental",
  checks: [],
};
async function check(name, task) {
  try {
    const evidence = await task();
    result.checks.push({ name, status: "PASS", evidence });
  } catch (e) {
    result.checks.push({ name, status: "NOT VERIFIED", reason: e.message });
  }
}
async function json(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  return r.json();
}
await check("local API/MySQL readiness", () =>
  json("http://localhost:3000/health/ready"),
);
await check("SQL schema and real records", async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const [migrations] = await c.query(
      "SELECT name FROM schema_migrations ORDER BY name",
    );
    const [counts] = await c.query(
      "SELECT c.name,COUNT(r.id) AS recipes FROM categories c LEFT JOIN recipes r ON r.category_id=c.id GROUP BY c.id,c.name ORDER BY c.name",
    );
    const [tables] = await c.query("SHOW TABLES");
    const [grants] = await c.query("SHOW GRANTS");
    return {
      migrations,
      counts,
      tables,
      grants,
      note: "Native development DB privileges are separate from Docker runtime grants.",
    };
  } finally {
    await c.end();
  }
});
await check("Prometheus current targets", async () => {
  const { data } = await json("http://localhost:9090/api/v1/targets");
  return data.activeTargets.map((t) => ({
    job: t.labels.job,
    health: t.health,
    lastError: t.lastError,
  }));
});
const targetSnapshot = result.checks.find(
  (c) => c.name === "Prometheus current targets",
);
if (targetSnapshot?.evidence?.some((t) => t.health !== "up")) {
  targetSnapshot.status = "FAIL";
  targetSnapshot.reason =
    "At least one native target is DOWN; snapshot retained, not a healthy-stack PASS.";
}
for (const query of [
  'up{job="cookshare-api"}',
  "cookshare_http_requests_total",
  "mysql_up",
])
  await check(`PromQL ${query}`, async () => {
    const r = await json(
      "http://localhost:9090/api/v1/query?query=" + encodeURIComponent(query),
    );
    if (!r.data.result.length) throw Error("No current samples");
    return r.data.result;
  });
await fetch("http://localhost:3000/api/v1/de29-missing");
const queries = [
  '{job="cookshare",service="api"}',
  '{job="cookshare",service="api"} | json | __error__="" | status >= 400',
  'sum by(status)(count_over_time({job="cookshare",service="api"} | json | __error__="" [5m]))',
];
for (const [i, query] of queries.entries())
  await check(`LogQL ${i + 1}`, async () => {
    const endpoint = i === 2 ? "query" : "query_range";
    const r = await json(
      `http://localhost:3100/loki/api/v1/${endpoint}?query=${encodeURIComponent(query)}${i === 2 ? "" : "&limit=5"}`,
    );
    if (!r.data.result.length) throw Error("No current log results");
    return {
      query,
      result: r.data.result,
      collector: "Native Alloy file tail, not Docker discovery",
    };
  });
await check("Alloy native readiness", async () => {
  const r = await fetch("http://localhost:12345/-/ready");
  if (!r.ok) throw Error(`HTTP ${r.status}`);
  return await r.text();
});
await check("Grafana native health", () =>
  json("http://localhost:3001/api/health"),
);
await writeFile(
  new URL("local-runtime.json", folder),
  JSON.stringify(result, null, 2) + "\n",
);
for (const c of result.checks) console.log(`${c.status} ${c.name}`);
