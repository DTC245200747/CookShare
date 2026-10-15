import mysql from "mysql2/promise";
import { dbEnv as env } from "./database-env.js";
export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: 10,
  decimalNumbers: true,
  multipleStatements: false,
  timezone: "Z",
});
// MySQL TIMESTAMP values and API ISO dates must share the same timezone.
pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'");
});
