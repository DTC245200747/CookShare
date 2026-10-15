import { readdir, readFile } from "node:fs/promises";
import { pool } from "./db.js";
const conn = await pool.getConnection();
try {
  const [locks] = await conn.query<any[]>(
    "SELECT GET_LOCK('cookshare_migrations', 30) AS acquired",
  );
  if (locks[0].acquired !== 1) throw Error("Could not acquire migration lock");
  await conn.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
  );
  const folder = new URL("../../../database/migrations/", import.meta.url);
  for (const file of (await readdir(folder))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const [rows] = await conn.query<any[]>(
      "SELECT name FROM schema_migrations WHERE name=?",
      [file],
    );
    if (rows.length) continue;
    // MySQL DDL auto-commits: migrations must be restartable (IF NOT EXISTS).
    for (const sql of (await readFile(new URL(file, folder), "utf8"))
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await conn.query(sql);
    await conn.query("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
    console.log(`Applied ${file}`);
  }
} finally {
  await conn.query("SELECT RELEASE_LOCK('cookshare_migrations')");
  conn.release();
  await pool.end();
}
