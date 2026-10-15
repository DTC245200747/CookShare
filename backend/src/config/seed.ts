import bcrypt from "bcryptjs";
import { pool } from "./db.js";
import { seedRecipes } from "./seed-recipes.js";
const password = process.env.SEED_ADMIN_PASSWORD;
if (
  !password ||
  Buffer.byteLength(password) < 10 ||
  Buffer.byteLength(password) > 72
)
  throw Error("Set SEED_ADMIN_PASSWORD (10–72 bytes)");
const c = await pool.getConnection();
try {
  await c.beginTransaction();
  // Existing accounts are never silently promoted or have their password reset.
  await c.query(
    "INSERT IGNORE INTO users (name,email,password_hash,role) VALUES (?,?,?,'admin')",
    [
      "CookShare Admin",
      "admin@cookshare.local",
      await bcrypt.hash(password, 12),
    ],
  );
  const [users] = await c.query<any[]>(
    "SELECT id FROM users WHERE email='admin@cookshare.local' AND role='admin'",
  );
  if (!users[0])
    throw Error("Seed email already belongs to a non-admin account");
  await c.query(
    "INSERT IGNORE INTO categories(name,description) VALUES ('Món chính','Các món ăn chính'),('Salad','Món rau tươi'),('Tráng miệng','Món ngọt')",
  );
  await c.query(
    "INSERT IGNORE INTO ingredients(name) VALUES ('Thịt bò'),('Bánh tortilla'),('Cà chua'),('Xà lách'),('Muối')",
  );
  const [existing] = await c.query<any[]>(
    "SELECT id FROM recipes WHERE author_id=? AND title=?",
    [users[0].id, "Taco bò kiểu Mexico"],
  );
  if (!existing.length) {
    const [cats] = await c.query<any[]>(
      "SELECT id FROM categories WHERE name='Món chính'",
    );
    const [r] = await c.query<any>(
      "INSERT INTO recipes(author_id,category_id,title,description,prep_minutes,cook_minutes,servings,difficulty) VALUES (?,?,?, ?,15,10,4,'easy')",
      [
        users[0].id,
        cats[0].id,
        "Taco bò kiểu Mexico",
        "Taco bò với rau tươi, dễ làm cho bữa tối.",
      ],
    );
    for (const [name, quantity, unit] of [
      ["Thịt bò", 500, "g"],
      ["Bánh tortilla", 8, "cái"],
      ["Cà chua", 2, "quả"],
      ["Xà lách", 100, "g"],
      ["Muối", 2, "g"],
    ])
      await c.query(
        "INSERT INTO recipe_ingredients(recipe_id,ingredient_id,quantity,unit) SELECT ?,id,?,? FROM ingredients WHERE name=?",
        [r.insertId, quantity, unit, name],
      );
    for (const [i, step] of [
      "Rửa sạch rau và thái cà chua.",
      "Xào thịt bò với muối đến khi chín kỹ.",
      "Làm nóng tortilla, thêm thịt bò và rau, dùng ngay.",
    ].entries())
      await c.query("INSERT INTO recipe_steps VALUES (?,?,?)", [
        r.insertId,
        i + 1,
        step,
      ]);
  }
  await c.commit();
  await seedRecipes(users[0].id);
  console.log("Seed complete");
} catch (e) {
  await c.rollback();
  throw e;
} finally {
  c.release();
  await pool.end();
}
