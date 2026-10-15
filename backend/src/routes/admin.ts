import { Router } from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { authenticate, admin } from "../middleware/auth.js";
import { ApiError } from "../middleware/errors.js";
import { idSchema } from "../services/validation.js";
export const administration = Router();
administration.use(authenticate, admin);
const paging = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().trim().max(100).default(""),
  status: z
    .enum(["all", "published", "hidden", "active", "disabled"])
    .default("all"),
});
administration.get("/stats", async (req, res) => {
  const [counts] = await pool.query<any[]>(
    "SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM recipes) AS recipes,(SELECT COUNT(*) FROM categories) AS categories,(SELECT COUNT(*) FROM comments) AS comments,(SELECT COUNT(*) FROM favorites) AS favorites",
  );
  const [activity] = await pool.query(
    "SELECT DATE(created_at) AS day,COUNT(*) AS count FROM recipes WHERE created_at>=UTC_DATE()-INTERVAL 29 DAY GROUP BY DATE(created_at) ORDER BY day",
  );
  const [distribution] = await pool.query(
    "SELECT c.name,COUNT(r.id) AS count FROM categories c LEFT JOIN recipes r ON r.category_id=c.id GROUP BY c.id,c.name ORDER BY count DESC",
  );
  res.json({ data: { ...counts[0], activity, distribution } });
});
administration.get("/users", async (req, res) => {
  const q = paging.parse(req.query),
    values: unknown[] = [`%${q.q}%`, `%${q.q}%`];
  let where = " WHERE (u.name LIKE ? OR u.email LIKE ?)";
  if (["active", "disabled"].includes(q.status)) {
    where += " AND COALESCE(s.active,1)=?";
    values.push(q.status === "active" ? 1 : 0);
  }
  const from = " FROM users u LEFT JOIN user_security s ON s.user_id=u.id";
  const [count] = await pool.query<any[]>(
    "SELECT COUNT(*) AS total" + from + where,
    values,
  );
  const [data] = await pool.query(
    "SELECT u.id,u.name,u.email,u.role,u.created_at,COALESCE(s.active,1) AS active" +
      from +
      where +
      " ORDER BY u.id DESC LIMIT ? OFFSET ?",
    [...values, q.limit, (q.page - 1) * q.limit],
  );
  res.json({
    data,
    pagination: { page: q.page, limit: q.limit, total: count[0].total },
  });
});
administration.patch("/users/:id", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const input = z
    .object({ role: z.enum(["member", "admin"]), active: z.boolean() })
    .strict()
    .parse(req.body);
  if (id === req.user!.id)
    throw new ApiError(400, "Cannot change your own administrative access");
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [rows] = await c.query<any[]>(
      "SELECT id FROM users WHERE id=? FOR UPDATE",
      [id],
    );
    if (!rows[0]) throw new ApiError(404, "User not found");
    await c.query("UPDATE users SET role=? WHERE id=?", [input.role, id]);
    await c.query(
      "INSERT INTO user_security(user_id,active,token_version) VALUES (?,?,1) ON DUPLICATE KEY UPDATE active=VALUES(active),token_version=token_version+1",
      [id, input.active],
    );
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
  res.json({ data: { id, ...input } });
});
administration.get("/recipes", async (req, res) => {
  const q = paging.parse(req.query);
  let where = " WHERE r.title LIKE ?";
  const values: unknown[] = [`%${q.q}%`];
  if (["published", "hidden"].includes(q.status)) {
    where += " AND COALESCE(m.status,'published')=?";
    values.push(q.status);
  }
  const from =
    " FROM recipes r JOIN users u ON u.id=r.author_id LEFT JOIN recipe_moderation m ON m.recipe_id=r.id";
  const [count] = await pool.query<any[]>(
    "SELECT COUNT(*) AS total" + from + where,
    values,
  );
  const [data] = await pool.query(
    "SELECT r.*,u.name AS author_name,COALESCE(m.status,'published') AS status" +
      from +
      where +
      " ORDER BY r.id DESC LIMIT ? OFFSET ?",
    [...values, q.limit, (q.page - 1) * q.limit],
  );
  res.json({
    data,
    pagination: { page: q.page, limit: q.limit, total: count[0].total },
  });
});
administration.patch("/recipes/:id/status", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const { status } = z
    .object({ status: z.enum(["published", "hidden"]) })
    .strict()
    .parse(req.body);
  await pool.query(
    "INSERT INTO recipe_moderation(recipe_id,status) VALUES (?,?) ON DUPLICATE KEY UPDATE status=VALUES(status)",
    [id, status],
  );
  res.json({ data: { id, status } });
});
administration.get("/comments", async (req, res) => {
  const q = paging.parse(req.query),
    values = [`%${q.q}%`];
  const from =
    " FROM comments c JOIN users u ON u.id=c.user_id JOIN recipes r ON r.id=c.recipe_id WHERE c.content LIKE ?";
  const [count] = await pool.query<any[]>(
    "SELECT COUNT(*) AS total" + from,
    values,
  );
  const [data] = await pool.query(
    "SELECT c.*,u.name AS author_name,r.title" +
      from +
      " ORDER BY c.id DESC LIMIT ? OFFSET ?",
    [...values, q.limit, (q.page - 1) * q.limit],
  );
  res.json({
    data,
    pagination: { page: q.page, limit: q.limit, total: count[0].total },
  });
});
