import { readFile } from "node:fs/promises";
import { pool } from "./db.js";
// JSON is used so compiled Docker runtime does not need TypeScript tooling.
export async function seedRecipes(author: number) {
  const data = JSON.parse(
    await readFile(
      new URL("../../../database/seeds/recipes.json", import.meta.url),
      "utf8",
    ),
  ) as any[];
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    for (const item of data) {
      await c.query("INSERT IGNORE INTO categories(name) VALUES (?)", [
        item.category,
      ]);
      const [cat] = await c.query<any[]>(
        "SELECT id FROM categories WHERE name=?",
        [item.category],
      );
      const [existing] = await c.query<any[]>(
        "SELECT id FROM recipes WHERE author_id=? AND title=?",
        [author, item.title],
      );
      if (existing.length) continue;
      const [r] = await c.query<any>("INSERT INTO recipes SET ?", [
        {
          author_id: author,
          category_id: cat[0].id,
          title: item.title,
          description: `${item.title} — công thức tại nhà với nguyên liệu dễ tìm. Làm theo từng bước để có bữa ăn thơm ngon cho cả gia đình.`,
          image_url: `/images/${item.image}.jpg`,
          prep_minutes: item.prep,
          cook_minutes: item.cook,
          servings: 4,
          difficulty: item.difficulty,
        },
      ]);
      for (const [name, quantity, unit] of item.ingredients) {
        await c.query("INSERT IGNORE INTO ingredients(name) VALUES (?)", [
          name,
        ]);
        const [i] = await c.query<any[]>(
          "SELECT id FROM ingredients WHERE name=?",
          [name],
        );
        await c.query("INSERT INTO recipe_ingredients VALUES (?,?,?,?)", [
          r.insertId,
          i[0].id,
          quantity,
          unit,
        ]);
      }
      for (const [index, step] of item.steps.entries())
        await c.query("INSERT INTO recipe_steps VALUES (?,?,?)", [
          r.insertId,
          index + 1,
          step,
        ]);
    }
    await c.query(
      "UPDATE recipes SET image_url='/images/tacos.jpg' WHERE author_id=? AND title='Taco bò kiểu Mexico' AND image_url IS NULL",
      [author],
    );
    await c.commit();
    console.log("20 Vietnamese recipes seeded");
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
