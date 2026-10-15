import { pool } from "../config/db.js";
import { ApiError } from "../middleware/errors.js";
import type { User } from "../middleware/auth.js";
import type { RecipeInput } from "../services/validation.js";
export const aggregates =
  "(SELECT COUNT(*) FROM favorites f WHERE f.recipe_id=r.id) AS favorite_count,(SELECT COALESCE(AVG(score),0) FROM ratings rt WHERE rt.recipe_id=r.id) AS average_rating,(SELECT COUNT(*) FROM ratings rt WHERE rt.recipe_id=r.id) AS rating_count,COALESCE(m.status,'published') AS status";
export async function detail(id: number, user?: User) {
  const [rows] = await pool.query<any[]>(
    "SELECT r.*,u.name AS author_name,p.avatar_url AS author_avatar,c.name AS category_name," +
      aggregates +
      " FROM recipes r JOIN users u ON u.id=r.author_id JOIN categories c ON c.id=r.category_id LEFT JOIN user_profiles p ON p.user_id=u.id LEFT JOIN recipe_moderation m ON m.recipe_id=r.id WHERE r.id=?",
    [id],
  );
  if (!rows[0]) throw new ApiError(404, "Recipe not found");
  if (
    rows[0].status === "hidden" &&
    user?.role !== "admin" &&
    user?.id !== rows[0].author_id
  )
    throw new ApiError(404, "Recipe not found");
  const [ingredients] = await pool.query(
    "SELECT ri.ingredient_id,i.name,ri.quantity,ri.unit FROM recipe_ingredients ri JOIN ingredients i ON i.id=ri.ingredient_id WHERE recipe_id=? ORDER BY ingredient_id",
    [id],
  );
  const [steps] = await pool.query(
    "SELECT position,instruction FROM recipe_steps WHERE recipe_id=? ORDER BY position",
    [id],
  );
  return { ...rows[0], ingredients, steps };
}
export async function write(
  input: RecipeInput | undefined,
  user: User,
  id?: number,
) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    if (id) {
      const [r] = await c.query<any[]>(
        "SELECT author_id FROM recipes WHERE id=? FOR UPDATE",
        [id],
      );
      if (!r[0]) throw new ApiError(404, "Recipe not found");
      if (r[0].author_id !== user.id && user.role !== "admin")
        throw new ApiError(403, "Only owner or admin can modify recipe");
    }
    if (!input) {
      await c.query("DELETE FROM recipes WHERE id=?", [id]);
    } else {
      const { ingredients, steps, ...fields } = input;
      if (id) {
        await c.query("UPDATE recipes SET ? WHERE id=?", [fields, id]);
        await c.query("DELETE FROM recipe_ingredients WHERE recipe_id=?", [id]);
        await c.query("DELETE FROM recipe_steps WHERE recipe_id=?", [id]);
      } else {
        const [result] = await c.query<any>("INSERT INTO recipes SET ?", [
          { ...fields, author_id: user.id },
        ]);
        id = result.insertId;
      }
      for (const i of ingredients)
        await c.query("INSERT INTO recipe_ingredients SET ?", [
          { recipe_id: id, ...i },
        ]);
      for (const [index, instruction] of steps.entries())
        await c.query("INSERT INTO recipe_steps SET ?", [
          { recipe_id: id, position: index + 1, instruction },
        ]);
    }
    await c.commit();
    return id;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
