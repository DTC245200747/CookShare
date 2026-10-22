// Read-only freshness guard. Run again immediately before an approved cutover.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(
  new URL("../backend/package.json", import.meta.url),
);
const state = JSON.parse(
  await readFile(
    new URL("../docs/report-evidence/data-sync-staging.json", import.meta.url),
    "utf8",
  ),
);
const before = JSON.parse(
  await readFile(state.backup + "/before-snapshots.json", "utf8"),
);
const cfg = require("dotenv").parse(
  await readFile(new URL("../backend/.env", import.meta.url)),
);
async function digest(connection) {
  const [tables] = await connection.query(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME",
  );
  const result = {};
  function normalize(v) {
    if (v instanceof Date) return v.toISOString();
    if (Buffer.isBuffer(v)) return { hex: v.toString("hex") };
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, normalize(v[k])]),
      );
    return v;
  }
  for (const { name } of tables) {
    if (!/^[A-Za-z0-9_]+$/.test(name)) throw Error("Unexpected table name");
    const [rows] = await connection.query("SELECT * FROM `" + name + "`");
    result[name] = {
      rows: rows.length,
      sha256: createHash("sha256")
        .update(
          JSON.stringify(rows.map((r) => JSON.stringify(normalize(r))).sort()),
        )
        .digest("hex"),
    };
  }
  return result;
}
const expected = (tables) =>
  Object.fromEntries(
    Object.entries(tables).map(([k, v]) => [
      k,
      { rows: v.rows, sha256: v.sha256 },
    ]),
  );
const c = await require("mysql2/promise").createConnection({
  host: cfg.DB_HOST,
  port: Number(cfg.DB_PORT),
  user: cfg.DB_USER,
  password: cfg.DB_PASSWORD,
  database: cfg.DB_NAME,
  timezone: "Z",
  decimalNumbers: true,
});
try {
  await c.query("SET time_zone='+00:00'");
  assert.deepEqual(
    await digest(c),
    expected(before.source.tables),
    "Windows data changed since staging; resync/review required",
  );
} finally {
  await c.end();
}
const standalone = digest.toString();
for (const [name, tables] of [
  ["cookshare", before.target.tables],
  [state.stagingDb, before.source.tables],
]) {
  const script = `import {pool} from './dist/config/db.js';import {createHash} from 'node:crypto';const digest=${standalone};try{console.log(JSON.stringify(await digest(pool)))}finally{await pool.end()}`;
  const child = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      "-e",
      "DB_NAME=" + name,
      "cookshare-api-1",
      "node",
      "--input-type=module",
    ],
    { input: script, encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 0, "Docker read-only check failed");
  assert.deepEqual(
    JSON.parse(child.stdout),
    expected(tables),
    `Data changed in ${name}; review before cutover`,
  );
}
console.log(
  "Freshness guard PASS: Windows source, original Docker database and staged data are unchanged.",
);
