import type { RequestHandler } from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { idSchema, recipeSchema } from "../services/validation.js";
import { detail, write, aggregates } from "../repositories/recipes.js";
export const list: RequestHandler = async (req, res) => {
  const q = z
    .object({
      page: z.coerce.number().int().min(1).max(100000).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(12),
      category_id: idSchema.optional(),
      author_id: idSchema.optional(),
      q: z.string().trim().max(100).optional(),
      ingredient: z.string().trim().max(100).optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      max_minutes: z.coerce.number().int().positive().max(20160).optional(),
      sort: z.enum(["newest", "popular", "rating"]).default("newest"),
    })
    .strict()
    .parse(req.query);
  const filters: string[] = [];
  const values: unknown[] = [];
  if (q.category_id) {
    filters.push("r.category_id=?");
    values.push(q.category_id);
  }
  if (q.author_id) {
    filters.push("r.author_id=?");
    values.push(q.author_id);
  }
  if (q.q) {
    filters.push("r.title LIKE ?");
    values.push(`%${q.q}%`);
  }
  if (q.ingredient) {
    filters.push(
      "EXISTS(SELECT 1 FROM recipe_ingredients ri JOIN ingredients i ON i.id=ri.ingredient_id WHERE ri.recipe_id=r.id AND i.name LIKE ?)",
    );
    values.push(`%${q.ingredient}%`);
  }
  if (q.difficulty) {
    filters.push("r.difficulty=?");
    values.push(q.difficulty);
  }
  if (q.max_minutes) {
    filters.push("r.prep_minutes+r.cook_minutes<=?");
    values.push(q.max_minutes);
  }
  if (res.locals.mine) {
    filters.push("r.author_id=?");
    values.push(req.user!.id);
  } else {
    filters.push("COALESCE(m.status,'published')='published'");
  }
  if (res.locals.saved) {
    filters.push(
      "EXISTS(SELECT 1 FROM favorites f WHERE f.recipe_id=r.id AND f.user_id=?)",
    );
    values.push(req.user!.id);
  }
  const where = filters.length ? " WHERE " + filters.join(" AND ") : "";
  const joins =
    " FROM recipes r JOIN users u ON u.id=r.author_id JOIN categories c ON c.id=r.category_id LEFT JOIN recipe_moderation m ON m.recipe_id=r.id";
  const [counts] = await pool.query<any[]>(
    "SELECT COUNT(*) AS total" + joins + where,
    values,
  );
  const order = {
    newest: "r.created_at DESC",
    popular: "favorite_count DESC",
    rating: "average_rating DESC",
  }[q.sort];
  const [data] = await pool.query(
    "SELECT r.*,u.name AS author_name,c.name AS category_name," +
      aggregates +
      joins +
      where +
      " ORDER BY " +
      order +
      ",r.id DESC LIMIT ? OFFSET ?",
    [...values, q.limit, (q.page - 1) * q.limit],
  );
  res.json({
    data,
    pagination: { page: q.page, limit: q.limit, total: counts[0].total },
  });
};
export const get: RequestHandler = async (req, res) => {
  res.json({ data: await detail(idSchema.parse(req.params.id), req.user) });
};
export const create: RequestHandler = async (req, res) => {
  const id = await write(recipeSchema.parse(req.body), req.user!);
  res.status(201).json({ data: await detail(id!) });
};
export const update: RequestHandler = async (req, res) => {
  const id = idSchema.parse(req.params.id);
  await write(recipeSchema.parse(req.body), req.user!, id);
  res.json({ data: await detail(id, req.user) });
};
export const remove: RequestHandler = async (req, res) => {
  await write(undefined, req.user!, idSchema.parse(req.params.id));
  res.status(204).end();
};
