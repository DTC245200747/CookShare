import { Router } from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { ApiError } from "../middleware/errors.js";
import { idSchema } from "../services/validation.js";
export const community = Router();
const paging = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
async function visible(id: number) {
  const [r] = await pool.query<any[]>(
    "SELECT r.id FROM recipes r LEFT JOIN recipe_moderation m ON m.recipe_id=r.id WHERE r.id=? AND COALESCE(m.status,'published')='published'",
    [id],
  );
  if (!r[0]) throw new ApiError(404, "Recipe not found");
}
community.get("/me/favorites", authenticate, async (req, res) => {
  const [data] = await pool.query(
    "SELECT recipe_id FROM favorites WHERE user_id=?",
    [req.user!.id],
  );
  res.json({ data });
});
community.get("/recipes/:id/interactions", authenticate, async (req, res) => {
  const id = idSchema.parse(req.params.id);
  await visible(id);
  const [f] = await pool.query<any[]>(
    "SELECT recipe_id FROM favorites WHERE recipe_id=? AND user_id=?",
    [id, req.user!.id],
  );
  const [r] = await pool.query<any[]>(
    "SELECT score FROM ratings WHERE recipe_id=? AND user_id=?",
    [id, req.user!.id],
  );
  res.json({ data: { favorite: !!f.length, rating: r[0]?.score ?? 0 } });
});
community.put("/recipes/:id/favorite", authenticate, async (req, res) => {
  const id = idSchema.parse(req.params.id);
  await visible(id);
  await pool.query(
    "INSERT IGNORE INTO favorites(user_id,recipe_id) VALUES (?,?)",
    [req.user!.id, id],
  );
  res.status(204).end();
});
community.delete("/recipes/:id/favorite", authenticate, async (req, res) => {
  await pool.query("DELETE FROM favorites WHERE user_id=? AND recipe_id=?", [
    req.user!.id,
    idSchema.parse(req.params.id),
  ]);
  res.status(204).end();
});
community.put("/recipes/:id/rating", authenticate, async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const { score } = z
    .object({ score: z.number().int().min(1).max(5) })
    .strict()
    .parse(req.body);
  await visible(id);
  await pool.query(
    "INSERT INTO ratings(user_id,recipe_id,score) VALUES (?,?,?) ON DUPLICATE KEY UPDATE score=VALUES(score)",
    [req.user!.id, id, score],
  );
  res.json({ data: { score } });
});
community.get("/recipes/:id/comments", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  await visible(id);
  const q = paging.parse(req.query);
  const [count] = await pool.query<any[]>(
    "SELECT COUNT(*) AS total FROM comments WHERE recipe_id=?",
    [id],
  );
  const [data] = await pool.query(
    "SELECT c.*,u.name AS author_name,p.avatar_url FROM comments c JOIN users u ON u.id=c.user_id LEFT JOIN user_profiles p ON p.user_id=u.id WHERE c.recipe_id=? ORDER BY c.created_at DESC,c.id DESC LIMIT ? OFFSET ?",
    [id, q.limit, (q.page - 1) * q.limit],
  );
  res.json({ data, pagination: { ...q, total: count[0].total } });
});
const content = z
  .object({ content: z.string().trim().min(1).max(2000) })
  .strict();
community.post("/recipes/:id/comments", authenticate, async (req, res) => {
  const id = idSchema.parse(req.params.id);
  await visible(id);
  const input = content.parse(req.body);
  const [r] = await pool.query<any>(
    "INSERT INTO comments(user_id,recipe_id,content) VALUES (?,?,?)",
    [req.user!.id, id, input.content],
  );
  res.status(201).json({ data: { id: r.insertId, ...input } });
});
community.put("/comments/:id", authenticate, async (req, res) => {
  const id = idSchema.parse(req.params.id),
    input = content.parse(req.body);
  const [r] = await pool.query<any>(
    "UPDATE comments SET content=? WHERE id=? AND user_id=?",
    [input.content, id, req.user!.id],
  );
  if (!r.affectedRows)
    throw new ApiError(404, "Comment not found or not owned");
  res.json({ data: { id, ...input } });
});
community.delete("/comments/:id", authenticate, async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const [r] = await pool.query<any>(
    "DELETE FROM comments WHERE id=? AND (user_id=? OR ?='admin')",
    [id, req.user!.id, req.user!.role],
  );
  if (!r.affectedRows)
    throw new ApiError(404, "Comment not found or not owned");
  res.status(204).end();
});
