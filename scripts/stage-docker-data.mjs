// Non-destructive staging only. Does NOT switch the production Docker API.
// Private backups/env files live outside the repository, under workspace .tools.
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  cp,
  stat,
} from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const repo = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(
  new URL("../backend/package.json", import.meta.url),
);
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const source = dotenv.parse(await readFile(join(repo, "backend/.env")));
const composeEnv = dotenv.parse(await readFile(join(repo, ".env")));
const secretValues = [...Object.entries(source), ...Object.entries(composeEnv)]
  .filter(([k, v]) => /PASSWORD|SECRET|TOKEN/.test(k) && v.length > 8)
  .map(([, v]) => v);
const redact = (text) =>
  secretValues.reduce((s, v) => s.split(v).join("[REDACTED]"), String(text));
const resumed = process.env.COOKSHARE_SYNC_RESUME
  ? JSON.parse(await readFile(process.env.COOKSHARE_SYNC_RESUME, "utf8"))
  : null;
const stamp = resumed
  ? resumed.stagingDb.slice("cookshare_sync_".length)
  : new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14) +
    "_" +
    randomBytes(3).toString("hex");
const stagingDb = "cookshare_sync_" + stamp;
const stagingVolume = "cookshare_uploads_sync_" + stamp;
const stagingNetwork = "cookshare_sync_web_" + stamp;
const stageApi = "cookshare-api-sync-" + stamp;
const stageNginx = "cookshare-nginx-sync-" + stamp;
const backup = resolve(repo, "../.tools/backups", "cookshare-sync-" + stamp);
const state = resumed ?? {
  startedAt: new Date().toISOString(),
  status: "preparing",
  stagingDb,
  stagingVolume,
  stagingNetwork,
  stageApi,
  stageNginx,
  backup,
  stagingUrl: "http://localhost:18080",
  productionSwitched: false,
};
if (resumed) {
  assert.equal(resolve(resumed.backup), backup);
  assert.equal(resumed.productionSwitched, false);
}

function run(
  exe,
  args,
  { input, env = process.env, file, allowFailure = false } = {},
) {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(exe, args, {
      cwd: repo,
      env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "",
      error = "";
    const destination = file
      ? createWriteStream(file, { flags: "wx", mode: 0o600 })
      : null;
    if (destination) {
      proc.stdout.pipe(destination);
      destination.on("error", reject);
    } else proc.stdout.on("data", (chunk) => (output += chunk));
    proc.stderr.on("data", (chunk) => (error += chunk));
    proc.on("error", reject);
    // EPIPE is handled by the command's exit status; never print SQL input.
    proc.stdin.on("error", () => {});
    proc.on("close", (code) => {
      const finish = () =>
        code && !allowFailure
          ? reject(
              Error(
                redact(`${exe} failed (exit ${code}): ${error.slice(0, 2000)}`),
              ),
            )
          : resolvePromise({ code, stdout: output, stderr: error });
      if (destination && !destination.writableFinished)
        destination.once("finish", finish);
      else finish();
    });
    proc.stdin.end(input);
  });
}
const docker = (args, options) => run("docker", args, options);
const jsonDocker = async (args) => JSON.parse((await docker(args)).stdout);
const sqlIdentifier = (value) => {
  assert.match(value, /^[A-Za-z0-9_]+$/);
  return "`" + value + "`";
};
async function rootSql(sql) {
  return docker(
    [
      "exec",
      "-i",
      "cookshare-db-1",
      "sh",
      "-c",
      'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql -uroot --batch --raw --skip-column-names',
    ],
    { input: sql },
  );
}
async function saveState() {
  await writeFile(
    join(backup, "state.json"),
    JSON.stringify(state, null, 2) + "\n",
    { mode: 0o600 },
  );
}

// Only digests, metadata and counts leave this function, never row contents/hashes.
async function snapshot(connection) {
  function normalize(value) {
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return { hex: value.toString("hex") };
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((k) => [k, normalize(value[k])]),
      );
    return value;
  }
  const [identity] = await connection.query(
    "SELECT DATABASE() AS name,@@version AS version,@@hostname AS host",
  );
  const [names] = await connection.query(
    "SELECT TABLE_NAME AS name,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME",
  );
  const tables = {};
  for (const { name, engine } of names) {
    if (!/^[A-Za-z0-9_]+$/.test(name)) throw Error("Unexpected table name");
    const [rows] = await connection.query("SELECT * FROM `" + name + "`");
    const canonical = rows.map((row) => JSON.stringify(normalize(row))).sort();
    tables[name] = {
      rows: rows.length,
      engine,
      sha256: createHash("sha256")
        .update(JSON.stringify(canonical))
        .digest("hex"),
    };
  }
  const [columns] = await connection.query(
    "SELECT TABLE_NAME,COLUMN_NAME,ORDINAL_POSITION,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION",
  );
  const [foreignKeys] = await connection.query(
    "SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME,CONSTRAINT_NAME,ORDINAL_POSITION FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION",
  );
  return {
    identity: identity[0],
    tables,
    columns: normalize(columns),
    foreignKeys: normalize(foreignKeys),
  };
}
async function dockerSnapshot(database) {
  const script = `import {pool} from './dist/config/db.js';import {createHash} from 'node:crypto';const snapshot=${snapshot.toString()};try{console.log(JSON.stringify(await snapshot(pool)))}finally{await pool.end()}`;
  return JSON.parse(
    (
      await docker(
        [
          "exec",
          "-i",
          "-e",
          "DB_NAME=" + database,
          "cookshare-api-1",
          "node",
          "--input-type=module",
        ],
        { input: script },
      )
    ).stdout,
  );
}
async function fileManifest(folder, prefix = "") {
  const entries = [];
  for (const item of await readdir(join(folder, prefix), {
    withFileTypes: true,
  })) {
    const relative = prefix ? prefix + "/" + item.name : item.name;
    if (item.isDirectory())
      entries.push(...(await fileManifest(folder, relative)));
    else if (item.isFile()) {
      const data = await readFile(join(folder, relative));
      entries.push({
        file: relative,
        bytes: data.length,
        sha256: createHash("sha256").update(data).digest("hex"),
      });
    } else
      throw Error(
        "Uploads contain a symlink or non-regular entry; manual review required",
      );
  }
  return entries.sort((a, b) => a.file.localeCompare(b.file));
}
async function waitReady(url) {
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(url + "/health/ready", {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 1000));
  }
  throw Error("Staging HTTP readiness timeout");
}
async function httpJson(path, options = {}) {
  const response = await fetch(state.stagingUrl + path, {
    signal: AbortSignal.timeout(15000),
    ...options,
  });
  if (!response.ok)
    throw Error(`Staging ${path.split("?")[0]}: HTTP ${response.status}`);
  return response.json();
}

let sourceConnection;
try {
  assert.equal(source.DB_HOST, "127.0.0.1");
  assert.equal(source.DB_PORT, "3307");
  assert.equal(source.DB_NAME, "cookshare_local");
  const api = (await jsonDocker(["inspect", "cookshare-api-1"]))[0];
  const nginx = (await jsonDocker(["inspect", "cookshare-nginx-1"]))[0];
  const db = (await jsonDocker(["inspect", "cookshare-db-1"]))[0];
  const apiEnv = Object.fromEntries(
    api.Config.Env.map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
  );
  for (const [key, value] of Object.entries(apiEnv))
    if (/PASSWORD|SECRET|TOKEN/.test(key) && value.length > 8)
      secretValues.push(value);
  assert.equal(apiEnv.DB_NAME, "cookshare");
  assert.equal(apiEnv.DB_HOST, "db");
  assert.equal(api.State.Running, true);
  assert.equal(db.State.Running, true);
  state.original ??= {
    database: "cookshare",
    apiImage: api.Image,
    nginxImage: nginx.Image,
    apiContainerId: api.Id,
    uploadsVolume: api.Mounts.find(
      (m) => m.Destination === "/app/backend/uploads",
    )?.Name,
    databaseVolume: db.Mounts.find((m) => m.Destination === "/var/lib/mysql")
      ?.Name,
  };
  assert.ok(state.original.uploadsVolume);
  assert.ok(state.original.databaseVolume);
  sourceConnection = await mysql.createConnection({
    host: source.DB_HOST,
    port: Number(source.DB_PORT),
    user: source.DB_USER,
    password: source.DB_PASSWORD,
    database: source.DB_NAME,
    timezone: "Z",
    decimalNumbers: true,
  });
  await sourceConnection.query("SET time_zone='+00:00'");
  const savedSnapshots = resumed
    ? JSON.parse(await readFile(join(backup, "before-snapshots.json"), "utf8"))
    : null;
  const beforeSource =
    savedSnapshots?.source ?? (await snapshot(sourceConnection));
  const beforeTarget =
    savedSnapshots?.target ?? (await dockerSnapshot("cookshare"));
  if (resumed) {
    assert.deepEqual(
      (await snapshot(sourceConnection)).tables,
      beforeSource.tables,
    );
    assert.deepEqual(
      (await dockerSnapshot("cookshare")).tables,
      beforeTarget.tables,
    );
  }
  for (const [name, count] of Object.entries({
    recipes: 141,
    users: 17,
    categories: 6,
    ingredients: 172,
  }))
    assert.equal(
      beforeSource.tables[name].rows,
      count,
      `Source ${name} changed; review before proceeding`,
    );
  assert.ok(
    Object.values(beforeSource.tables).every((t) => t.engine === "InnoDB"),
    "Single-transaction requires InnoDB tables",
  );
  await mkdir(backup, { recursive: true, mode: 0o700 });
  const sid = (
    await run("powershell", [
      "-NoProfile",
      "-Command",
      "[Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
    ])
  ).stdout.trim();
  assert.match(sid, /^S-1-/);
  await run("icacls", [
    backup,
    "/inheritance:r",
    "/grant:r",
    `*${sid}:(OI)(CI)F`,
    "*S-1-5-18:(OI)(CI)F",
    "*S-1-5-32-544:(OI)(CI)F",
  ]);
  await saveState();
  const sourceDump = join(backup, "windows-source.sql");
  const sourceUploads = join(repo, "backend/uploads");
  const savedUploads = join(backup, "windows-uploads");
  let uploadManifest = resumed ? await fileManifest(savedUploads) : null;
  if (!resumed) {
    console.log(
      "Read-only preflight passed; backing up both databases and uploads into private workspace storage.",
    );
    await run(
      "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe",
      [
        "--host=" + source.DB_HOST,
        "--port=" + source.DB_PORT,
        "--user=" + source.DB_USER,
        "--single-transaction",
        "--skip-lock-tables",
        "--quick",
        "--routines",
        "--events",
        "--triggers",
        "--hex-blob",
        "--default-character-set=utf8mb4",
        "--set-gtid-purged=OFF",
        "--no-tablespaces",
        "--column-statistics=0",
        "--skip-add-drop-table",
        "--skip-add-locks",
        "--result-file=" + sourceDump,
        source.DB_NAME,
      ],
      { env: { ...process.env, MYSQL_PWD: source.DB_PASSWORD } },
    );
    const targetDump = join(backup, "docker-original.sql");
    await docker(
      [
        "exec",
        "cookshare-db-1",
        "sh",
        "-c",
        'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysqldump -uroot --single-transaction --skip-lock-tables --quick --routines --events --triggers --hex-blob --set-gtid-purged=OFF --no-tablespaces --skip-add-drop-table --skip-add-locks cookshare',
      ],
      { file: targetDump },
    );
    await cp(sourceUploads, savedUploads, {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    const targetUploads = join(backup, "docker-original-uploads");
    await mkdir(targetUploads);
    await docker([
      "cp",
      "cookshare-api-1:/app/backend/uploads/.",
      targetUploads,
    ]);
    uploadManifest = await fileManifest(savedUploads);
    assert.equal(
      uploadManifest.length,
      26,
      "Source upload count changed; review before import",
    );
    assert.deepEqual(
      await fileManifest(sourceUploads),
      uploadManifest,
      "Source uploads changed during backup",
    );
    const afterSource = await snapshot(sourceConnection),
      afterTarget = await dockerSnapshot("cookshare");
    assert.deepEqual(
      afterSource.tables,
      beforeSource.tables,
      "Source data changed during backup",
    );
    assert.deepEqual(
      afterTarget.tables,
      beforeTarget.tables,
      "Original Docker data changed during backup",
    );
    state.backups = {
      sourceDump: {
        file: "windows-source.sql",
        bytes: (await stat(sourceDump)).size,
        sha256: createHash("sha256")
          .update(await readFile(sourceDump))
          .digest("hex"),
      },
      targetDump: {
        file: "docker-original.sql",
        bytes: (await stat(targetDump)).size,
        sha256: createHash("sha256")
          .update(await readFile(targetDump))
          .digest("hex"),
      },
      windowsUploads: uploadManifest,
      dockerUploads: await fileManifest(targetUploads),
    };
    await writeFile(
      join(backup, "before-snapshots.json"),
      JSON.stringify({ source: beforeSource, target: beforeTarget }, null, 2) +
        "\n",
      { mode: 0o600 },
    );
    state.status = "backups-complete";
    await saveState();
    console.log(
      "Both logical SQL dumps and both upload backups verified. Original rows/files unchanged.",
    );
    const dump = await readFile(sourceDump);
    assert.ok(dump.length > 1000);
    assert.ok(
      !/^\s*(?:USE\s|CREATE DATABASE|DROP DATABASE|DROP TABLE)/im.test(
        dump.toString("utf8"),
      ),
      "Unexpected destructive/database-select statement in source dump",
    );
    const exists = await rootSql(
      `SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${stagingDb}';`,
    );
    assert.equal(
      exists.stdout.trim(),
      "0",
      "Staging schema already exists; refusing overwrite",
    );
    await rootSql(
      `CREATE DATABASE ${sqlIdentifier(stagingDb)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`,
    );
    state.status = "staging-database-created";
    await saveState();
    await docker(
      [
        "exec",
        "-i",
        "cookshare-db-1",
        "sh",
        "-c",
        'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql -uroot --binary-mode=1 --default-character-set=utf8mb4 "$@"',
        "sh",
        "--database=" + stagingDb,
      ],
      { input: dump },
    );
    const runtimeUser = apiEnv.DB_USER,
      migrationUser = composeEnv.DB_MIGRATION_USER || "cookshare_migrator";
    assert.match(runtimeUser, /^[A-Za-z0-9_]+$/);
    assert.match(migrationUser, /^[A-Za-z0-9_]+$/);
    const users = await rootSql(
      `SELECT COUNT(*) FROM mysql.user WHERE User IN ('${runtimeUser}','${migrationUser}') AND Host='%';`,
    );
    assert.equal(
      users.stdout.trim(),
      "2",
      "Expected existing runtime/migration users not found; no passwords will be changed",
    );
    await rootSql(
      `GRANT SELECT,INSERT,UPDATE,DELETE ON ${sqlIdentifier(stagingDb)}.* TO '${runtimeUser}'@'%'; GRANT ALL PRIVILEGES ON ${sqlIdentifier(stagingDb)}.* TO '${migrationUser}'@'%';`,
    );
  }
  const imported = await dockerSnapshot(stagingDb);
  assert.deepEqual(
    imported.tables,
    beforeSource.tables,
    "Imported row digests differ",
  );
  assert.deepEqual(
    imported.columns,
    beforeSource.columns,
    "Imported column definitions differ",
  );
  assert.deepEqual(
    imported.foreignKeys,
    beforeSource.foreignKeys,
    "Imported foreign keys differ",
  );
  state.rowCounts = Object.fromEntries(
    Object.entries(imported.tables).map(([k, v]) => [k, v.rows]),
  );
  state.validation = {
    allTableDigestsMatch: true,
    columnDefinitionsMatch: true,
    foreignKeyDefinitionsMatch: true,
    sourceVersion: beforeSource.identity.version,
    targetVersion: imported.identity.version,
  };
  console.log(
    "Import succeeded: every table count and row digest matches, including IDs, password hashes and timestamps.",
  );
  const volumes = (
    await docker(["volume", "ls", "--format", "{{.Name}}"])
  ).stdout.split(/\r?\n/);
  if (!resumed) {
    assert.ok(
      !volumes.includes(stagingVolume),
      "Staging volume already exists",
    );
    await docker(["volume", "create", stagingVolume]);
  } else
    assert.ok(
      volumes.includes(stagingVolume),
      "Expected isolated staging volume",
    );
  // Old image IDs may have been removed after a rebuild. Export live read-only
  // root filesystems without pausing the containers, then create local images
  // with only non-secret config. No running service is stopped or recreated.
  const preserved = {};
  for (const [name, container] of [
    ["api", api],
    ["nginx", nginx],
  ]) {
    const tar = join(backup, name + "-rootfs.tar"),
      imageTag = "cookshare-" + name + ":preserved-sync-" + stamp;
    const already = await docker(["image", "inspect", imageTag], {
      allowFailure: true,
    });
    if (already.code !== 0) {
      try {
        await stat(tar);
      } catch {
        await docker(["export", "--output", tar, container.Id]);
      }
      const changes = [
        "--change",
        "USER " + container.Config.User,
        "--change",
        "WORKDIR " + (container.Config.WorkingDir || "/"),
      ];
      if (container.Config.Entrypoint)
        changes.push(
          "--change",
          "ENTRYPOINT " + JSON.stringify(container.Config.Entrypoint),
        );
      if (container.Config.Cmd)
        changes.push("--change", "CMD " + JSON.stringify(container.Config.Cmd));
      for (const line of container.Config.Env) {
        const key = line.slice(0, line.indexOf("="));
        if (!/PASSWORD|SECRET|TOKEN/.test(key))
          changes.push("--change", "ENV " + line);
      }
      await docker(["import", ...changes, tar, imageTag]);
    }
    preserved[name] = imageTag;
  }
  state.preservedImages = preserved;
  const originalEnvPath = join(backup, "original-api.env"),
    originalEnvContent = api.Config.Env.join("\n") + "\n";
  try {
    assert.ok(
      (await readFile(originalEnvPath, "utf8")) === originalEnvContent,
      "Original runtime environment changed; review required",
    );
  } catch (e) {
    if (e.code === "ENOENT")
      await writeFile(originalEnvPath, originalEnvContent, {
        mode: 0o600,
        flag: "wx",
      });
    else throw e;
  }
  const apiImage = preserved.api,
    nginxImage = preserved.nginx;
  const copyScript = `import {copyFile,mkdir,readFile,readdir,chown,chmod} from 'node:fs/promises';import {createHash} from 'node:crypto';async function copy(s,d){await mkdir(d,{recursive:true});for(const e of await readdir(s,{withFileTypes:true})){const a=s+'/'+e.name,b=d+'/'+e.name;if(e.isDirectory())await copy(a,b);else if(e.isFile()){try{await copyFile(a,b,1)}catch(x){if(x.code!=='EEXIST')throw x;const digest=v=>createHash('sha256').update(v).digest('hex');if(digest(await readFile(a))!==digest(await readFile(b)))throw Error('Existing staging file differs; overwrite refused')}}else throw Error('Unexpected upload entry')}}await copy('/sync-source','/sync-uploads');async function own(path){await chown(path,1000,1000);await chmod(path,0o750);for(const e of await readdir(path,{withFileTypes:true})){const p=path+'/'+e.name;if(e.isDirectory())await own(p);else{await chown(p,1000,1000);await chmod(p,0o640)}}}await own('/sync-uploads');console.log('New isolated upload volume populated; source mount read-only');`;
  await docker([
    "run",
    "--rm",
    "--network",
    "none",
    "--user",
    "0",
    "--mount",
    `type=volume,source=${stagingVolume},target=/sync-uploads`,
    "--mount",
    `type=bind,source=${savedUploads},target=/sync-source,readonly`,
    "--entrypoint",
    "node",
    apiImage,
    "--input-type=module",
    "-e",
    copyScript,
  ]);
  const manifestScript = `import {readFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';const fileManifest=${fileManifest.toString()};const join=(...p)=>p.join('/');console.log(JSON.stringify(await fileManifest('/sync-uploads')));`;
  const copied = JSON.parse(
    (
      await docker([
        "run",
        "--rm",
        "--network",
        "none",
        "--mount",
        `type=volume,source=${stagingVolume},target=/sync-uploads,readonly`,
        "--entrypoint",
        "node",
        apiImage,
        "--input-type=module",
        "-e",
        manifestScript,
      ])
    ).stdout,
  );
  assert.deepEqual(copied, uploadManifest, "Copied uploads differ");
  state.validation.uploadFiles = 26;
  state.validation.uploadHashesMatch = true;
  await docker(["network", "create", stagingNetwork]);
  apiEnv.DB_NAME = stagingDb;
  apiEnv.CORS_ORIGIN = state.stagingUrl;
  const envFile = join(backup, "staging-api.env");
  assert.ok(
    Object.values(apiEnv).every((v) => !/[\r\n]/.test(v)),
    "Multiline environment value requires manual review",
  );
  await writeFile(
    envFile,
    Object.entries(apiEnv)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
    { mode: 0o600, flag: "wx" },
  );
  await docker([
    "create",
    "--name",
    stageApi,
    "--network",
    "cookshare_database",
    "--env-file",
    envFile,
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges:true",
    "--mount",
    `type=volume,source=${stagingVolume},target=/app/backend/uploads`,
    apiImage,
  ]);
  await docker([
    "network",
    "connect",
    "--alias",
    "api",
    stagingNetwork,
    stageApi,
  ]);
  await docker(["start", stageApi]);
  await docker([
    "run",
    "-d",
    "--name",
    stageNginx,
    "--network",
    stagingNetwork,
    "--publish",
    "127.0.0.1:18080:8080",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges:true",
    "--mount",
    `type=bind,source=${join(repo, "nginx/nginx.conf")},target=/etc/nginx/conf.d/default.conf,readonly`,
    nginxImage,
  ]);
  await waitReady(state.stagingUrl);
  const recipes = await httpJson("/api/v1/recipes?limit=100");
  assert.equal(recipes.pagination.total, 141);
  const all = [
    ...recipes.data,
    ...(await httpJson("/api/v1/recipes?limit=100&page=2")).data,
  ];
  assert.equal(new Set(all.map((r) => r.id)).size, 141);
  let checkedDetails = 0;
  const imageUrls = new Set();
  for (const recipe of all) {
    const { data } = await httpJson("/api/v1/recipes/" + recipe.id);
    assert.ok(
      data.ingredients.length > 0 && data.steps.length > 0,
      `Incomplete recipe ${recipe.id}`,
    );
    if (data.image_url) imageUrls.add(data.image_url);
    checkedDetails++;
  }
  const [avatars] = await sourceConnection.query(
    "SELECT avatar_url FROM user_profiles WHERE avatar_url LIKE '/uploads/%'",
  );
  for (const avatar of avatars) imageUrls.add(avatar.avatar_url);
  for (const image of imageUrls) {
    assert.ok(
      image.startsWith("/"),
      "External image requires separate verification",
    );
    const response = await fetch(state.stagingUrl + image, {
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200, `Missing image ${image}`);
    assert.match(response.headers.get("content-type"), /^image\//);
    if (image.startsWith("/uploads/")) {
      const expected = uploadManifest.find(
        (f) => "/uploads/" + f.file === image,
      );
      assert.ok(expected);
      assert.equal(
        createHash("sha256")
          .update(Buffer.from(await response.arrayBuffer()))
          .digest("hex"),
        expected.sha256,
      );
    }
  }
  const sourceLogin = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@cookshare.local",
      password: source.SEED_ADMIN_PASSWORD,
    }),
  });
  assert.equal(
    sourceLogin.status,
    200,
    "Stored Windows seed admin credential no longer matches; request manual login verification",
  );
  const login = await httpJson("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@cookshare.local",
      password: source.SEED_ADMIN_PASSWORD,
    }),
  });
  assert.ok(login.data.access_token);
  assert.equal(login.data.user.role, "admin");
  const headers = { Authorization: "Bearer " + login.data.access_token };
  const me = await httpJson("/api/v1/auth/me", { headers });
  assert.equal(me.data.id, login.data.user.id);
  const stats = await httpJson("/api/v1/admin/stats", { headers });
  assert.ok(stats.data);
  const integrityScript = `import {pool} from './dist/config/db.js';try{const [keys]=await pool.query("SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL");let checked=0;const qi=v=>String.fromCharCode(96)+v+String.fromCharCode(96);for(const k of keys){for(const v of Object.values(k))if(!/^[A-Za-z0-9_]+$/.test(v))throw Error('Identifier');const q='SELECT COUNT(*) AS n FROM '+qi(k.TABLE_NAME)+' c LEFT JOIN '+qi(k.REFERENCED_TABLE_NAME)+' p ON c.'+qi(k.COLUMN_NAME)+'=p.'+qi(k.REFERENCED_COLUMN_NAME)+' WHERE c.'+qi(k.COLUMN_NAME)+' IS NOT NULL AND p.'+qi(k.REFERENCED_COLUMN_NAME)+' IS NULL';const [r]=await pool.query(q);if(r[0].n)throw Error('Orphan rows');checked++}console.log(JSON.stringify({orphanRows:0,foreignKeysChecked:checked}))}finally{await pool.end()}`;
  state.validation.integrity = JSON.parse(
    (
      await docker(["exec", "-i", stageApi, "node", "--input-type=module"], {
        input: integrityScript,
      })
    ).stdout,
  );
  state.validation.http = {
    recipes: 141,
    details: checkedDetails,
    images: imageUrls.size,
    login: true,
    authenticatedProfile: true,
    adminStats: true,
  };
  assert.deepEqual(
    (await dockerSnapshot("cookshare")).tables,
    beforeTarget.tables,
    "Original Docker database changed during staging",
  );
  assert.deepEqual(
    (await snapshot(sourceConnection)).tables,
    beforeSource.tables,
    "Windows database changed during staging",
  );
  assert.deepEqual(
    await fileManifest(sourceUploads),
    uploadManifest,
    "Windows uploads changed",
  );
  const finalImported = await dockerSnapshot(stagingDb);
  assert.deepEqual(
    finalImported.tables,
    beforeSource.tables,
    "Staging data changed during read-only verification",
  );
  const tag = "cookshare-api:validated-sync-" + stamp;
  await docker(["image", "tag", apiImage, tag]);
  const override = `# Prepared only; apply after explicit cutover confirmation.\nservices:\n  api:\n    image: ${tag}\n    pull_policy: never\n    environment:\n      DB_NAME: ${stagingDb}\n    volumes:\n      - synced_uploads:/app/backend/uploads\n  migrate:\n    environment:\n      DB_NAME: ${stagingDb}\n  seed:\n    environment:\n      DB_NAME: ${stagingDb}\nvolumes:\n  synced_uploads:\n    external: true\n    name: ${stagingVolume}\n`;
  const overrideFile = join(repo, "docker-compose.synced.yml");
  await writeFile(overrideFile, override, { flag: "wx" });
  const resolved = JSON.parse(
    (
      await docker([
        "compose",
        "-f",
        "docker-compose.yml",
        "-f",
        "docker-compose.monitoring.yml",
        "-f",
        "docker-compose.synced.yml",
        "--profile",
        "tools",
        "config",
        "--format",
        "json",
      ])
    ).stdout,
  );
  assert.equal(resolved.services.api.environment.DB_NAME, stagingDb);
  assert.equal(
    resolved.services.api.volumes.find(
      (v) => v.target === "/app/backend/uploads",
    ).source,
    "synced_uploads",
  );
  assert.equal(
    resolved.services.db.environment.MYSQL_DATABASE,
    "cookshare",
    "Original database service must stay unchanged",
  );
  state.overrideFile = "docker-compose.synced.yml";
  state.status = "validated-awaiting-cutover-approval";
  state.completedAt = new Date().toISOString();
  await saveState();
  await writeFile(
    join(backup, "after-staging-snapshot.json"),
    JSON.stringify(finalImported, null, 2) + "\n",
    { mode: 0o600 },
  );
  const publicReport = {
    ...state,
    backups: {
      sourceDump: state.backups.sourceDump,
      targetDump: state.backups.targetDump,
      windowsUploadFiles: uploadManifest.length,
      dockerUploadFiles: state.backups.dockerUploads.length,
    },
  };
  await mkdir(join(repo, "docs/report-evidence"), { recursive: true });
  await writeFile(
    join(repo, "docs/report-evidence/data-sync-staging.json"),
    JSON.stringify(publicReport, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        status: state.status,
        backup,
        stagingDb,
        stagingVolume,
        stagingUrl: state.stagingUrl,
        counts: state.rowCounts,
        validation: state.validation,
        productionSwitched: false,
      },
      null,
      2,
    ),
  );
} catch (error) {
  state.status = "staging-stopped";
  state.error = redact(error.message);
  try {
    await saveState();
  } catch {}
  console.error(redact(error.message));
  console.error(
    "Stopped without switching production. Existing source/target databases and volumes were not deleted. Any staging resources are retained for review.",
  );
  process.exitCode = 1;
} finally {
  await sourceConnection?.end();
}
