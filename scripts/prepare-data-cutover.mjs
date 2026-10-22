// Creates rollback configuration and validates the plan. No containers are changed.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
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
const rootEnv = require("dotenv").parse(
  await readFile(new URL("../.env", import.meta.url)),
);
const originalEnv = require("dotenv").parse(
  await readFile(state.backup + "/original-api.env"),
);
for (const key of ["DB_PASSWORD", "JWT_SECRET"])
  assert.ok(
    rootEnv[key] === originalEnv[key],
    `${key} in Compose differs from the running API; review required before any switch`,
  );
assert.equal(rootEnv.DB_NAME, "cookshare");
const rollback = `# Recovery plan only. Applying this requires explicit confirmation.\nservices:\n  api:\n    image: ${state.preservedImages.api}\n    pull_policy: never\n    environment:\n      DB_NAME: cookshare\n    volumes:\n      - rollback_uploads:/app/backend/uploads\n  migrate:\n    environment:\n      DB_NAME: cookshare\n  seed:\n    environment:\n      DB_NAME: cookshare\nvolumes:\n  rollback_uploads:\n    external: true\n    name: ${state.original.uploadsVolume}\n`;
await writeFile(
  new URL("../docker-compose.rollback.yml", import.meta.url),
  rollback,
  { flag: "wx" },
);
for (const [file, expectedDb, volume] of [
  ["docker-compose.synced.yml", state.stagingDb, "synced_uploads"],
  ["docker-compose.rollback.yml", "cookshare", "rollback_uploads"],
]) {
  const child = spawnSync(
    "docker",
    [
      "compose",
      "-f",
      "docker-compose.yml",
      "-f",
      "docker-compose.monitoring.yml",
      "-f",
      file,
      "--profile",
      "tools",
      "config",
      "--format",
      "json",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 0, "Compose plan failed validation");
  const resolved = JSON.parse(child.stdout);
  assert.equal(resolved.services.api.environment.DB_NAME, expectedDb);
  assert.equal(
    resolved.services.api.volumes.find(
      (v) => v.target === "/app/backend/uploads",
    ).source,
    volume,
  );
  assert.equal(resolved.services.db.environment.MYSQL_DATABASE, "cookshare");
}
const report = {
  timestamp: new Date().toISOString(),
  status: "awaiting-explicit-approval",
  stagingVerified: true,
  composeCredentialsMatchRunningApi: true,
  cutoverConfig: "docker-compose.synced.yml",
  rollbackConfig: "docker-compose.rollback.yml",
  plannedInterruption:
    "Recreate API only, wait healthy, reload Nginx DNS/upstream; short interruption possible",
  databasesRetained: ["cookshare", state.stagingDb],
  volumesRetained: [state.original.uploadsVolume, state.stagingVolume],
  originalImagesPreserved: true,
  productionSwitched: false,
};
await writeFile(
  new URL(
    "../docs/report-evidence/data-sync-cutover-plan.json",
    import.meta.url,
  ),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  "Cutover/rollback Compose plans validated; credentials match the running API. No cutover performed.",
);
