import { Router } from "express";
import { pool } from "../config/db.js";
import { authenticate, admin } from "../middleware/auth.js";
import { ApiError } from "../middleware/errors.js";
import { idSchema, taxonomySchema } from "../services/validation.js";
export function taxonomy(table: "categories" | "ingredients") {
  const r = Router();
  r.get("/", async (req, res) => {
    const [data] = await pool.query(`SELECT * FROM ${table} ORDER BY name`);
    res.json({ data });
  });
  r.get("/:id", async (req, res) => {
    const [data] = await pool.query<any[]>(
      `SELECT * FROM ${table} WHERE id=?`,
      [idSchema.parse(req.params.id)],
    );
    if (!data[0]) throw new ApiError(404, "Resource not found");
    res.json({ data: data[0] });
  });
  r.post(
    "/",
    authenticate,
    ...(table === "categories" ? [admin] : []),
    async (req, res) => {
      const input = taxonomySchema.parse(req.body);
      const [result] = await pool.query<any>(`INSERT INTO ${table} SET ?`, [
        input,
      ]);
      res.status(201).json({ data: { id: result.insertId, ...input } });
    },
  );
  r.put("/:id", authenticate, admin, async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const input = taxonomySchema.parse(req.body);
    const [result] = await pool.query<any>(`UPDATE ${table} SET ? WHERE id=?`, [
      { description: null, ...input },
      id,
    ]);
    if (!result.affectedRows) throw new ApiError(404, "Resource not found");
    res.json({ data: { id, ...input } });
  });
  r.delete("/:id", authenticate, admin, async (req, res) => {
    const [result] = await pool.query<any>(`DELETE FROM ${table} WHERE id=?`, [
      idSchema.parse(req.params.id),
    ]);
    if (!result.affectedRows) throw new ApiError(404, "Resource not found");
    res.status(204).end();
  });
  return r;
}
