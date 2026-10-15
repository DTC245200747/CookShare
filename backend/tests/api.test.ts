import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
process.env.DB_PASSWORD ??= "test-db-password";
process.env.JWT_SECRET ??= "test-only-secret-with-at-least-32-characters";
const { app } = await import("../src/app.js");
const { pool } = await import("../src/config/db.js");
describe("HTTP boundaries without database", () => {
  it("liveness and unknown route", async () => {
    expect((await request(app).get("/health/live")).status).toBe(200);
    expect((await request(app).get("/missing")).status).toBe(404);
  });
  it("requires authentication", async () => {
    expect((await request(app).post("/api/v1/recipes").send({})).status).toBe(
      401,
    );
    expect(
      (
        await request(app)
          .get("/api/v1/auth/me")
          .set("Authorization", "Bearer invalid")
      ).status,
    ).toBe(401);
  });
  it("rejects malformed JSON, invalid IDs and unsafe registration", async () => {
    expect(
      (
        await request(app)
          .post("/api/v1/auth/login")
          .set("Content-Type", "application/json")
          .send("{")
      ).status,
    ).toBe(400);
    expect((await request(app).get("/api/v1/recipes/invalid")).status).toBe(
      400,
    );
    expect((await request(app).get("/api/v1/recipes?limit=1000")).status).toBe(
      400,
    );
    expect(
      (
        await request(app)
          .post("/api/v1/auth/register")
          .send({
            name: "A",
            email: "a@example.com",
            password: "password123",
            role: "admin",
          })
      ).status,
    ).toBe(400);
  });
});
describe.skipIf(process.env.RUN_DB_TESTS !== "1")(
  "MySQL integration (dedicated test database only)",
  () => {
    let adminToken: string,
      memberToken: string,
      otherToken: string,
      category: number,
      ingredient: number,
      recipe: number;
    const suffix = Date.now();
    const emails = [`member${suffix}@test.local`, `other${suffix}@test.local`];
    const payload = () => ({
      title: "Taco test",
      description: "Recipe integration test",
      category_id: category,
      prep_minutes: 15,
      cook_minutes: 10,
      servings: 4,
      difficulty: "easy",
      ingredients: [{ ingredient_id: ingredient, quantity: 100, unit: "g" }],
      steps: ["Prepare ingredients", "Cook thoroughly"],
    });
    beforeAll(async () => {
      if (!process.env.DB_NAME?.endsWith("_test"))
        throw Error("DB_NAME must end with _test");
      const login = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "admin@cookshare.local",
          password: process.env.SEED_ADMIN_PASSWORD,
        });
      expect(login.status, JSON.stringify(login.body)).toBe(200);
      adminToken = login.body.data.access_token;
      for (const [i, email] of emails.entries()) {
        const r = await request(app)
          .post("/api/v1/auth/register")
          .send({ name: "Test user", email, password: "test-password-123" });
        expect(r.status).toBe(201);
        expect(r.body.data.role).toBe("member");
        const l = await request(app)
          .post("/api/v1/auth/login")
          .send({ email, password: "test-password-123" });
        expect(l.status).toBe(200);
        if (i === 0) memberToken = l.body.data.access_token;
        else otherToken = l.body.data.access_token;
      }
    }, 30000);
    afterAll(async () => {
      if (!process.env.DB_NAME?.endsWith("_test")) return;
      await pool.query(
        "DELETE FROM recipes WHERE author_id IN (SELECT id FROM users WHERE email IN (?,?))",
        emails,
      );
      await pool.query("DELETE FROM users WHERE email IN (?,?)", emails);
      if (category)
        await pool.query("DELETE FROM categories WHERE id=?", [category]);
      if (ingredient)
        await pool.query("DELETE FROM ingredients WHERE id=?", [ingredient]);
    });
    it("auth, uniqueness, role and invalid credentials", async () => {
      expect(
        (
          await request(app)
            .get("/api/v1/auth/me")
            .auth(memberToken, { type: "bearer" })
        ).body.data.email,
      ).toBe(emails[0]);
      expect(
        (
          await request(app)
            .post("/api/v1/auth/register")
            .send({
              name: "Duplicate",
              email: emails[0],
              password: "test-password-123",
            })
        ).status,
      ).toBe(409);
      expect(
        (
          await request(app)
            .post("/api/v1/auth/login")
            .send({ email: emails[0], password: "incorrect-password" })
        ).status,
      ).toBe(401);
      expect(
        (
          await request(app)
            .post("/api/v1/categories")
            .auth(memberToken, { type: "bearer" })
            .send({ name: "Denied" })
        ).status,
      ).toBe(403);
    });
    it("admin creates and edits categories and ingredients", async () => {
      for (const table of ["categories", "ingredients"]) {
        const r = await request(app)
          .post(`/api/v1/${table}`)
          .auth(adminToken, { type: "bearer" })
          .send({ name: `test-${table}-${suffix}` });
        expect(r.status).toBe(201);
        const id = r.body.data.id;
        if (table === "categories") category = id;
        else ingredient = id;
        expect((await request(app).get(`/api/v1/${table}/${id}`)).status).toBe(
          200,
        );
        expect(
          (
            await request(app)
              .put(`/api/v1/${table}/${id}`)
              .auth(adminToken, { type: "bearer" })
              .send({ name: `updated-${table}-${suffix}` })
          ).status,
        ).toBe(200);
      }
    });
    it("creates recipe with ingredients and ordered steps, filters and paginates", async () => {
      const r = await request(app)
        .post("/api/v1/recipes")
        .auth(memberToken, { type: "bearer" })
        .send(payload());
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      recipe = r.body.data.id;
      expect(r.body.data.ingredients[0].quantity).toBe(100);
      expect(r.body.data.steps.map((s: any) => s.position)).toEqual([1, 2]);
      const list = await request(app).get(
        `/api/v1/recipes?category_id=${category}&q=Taco&limit=1`,
      );
      expect(list.body.pagination.total).toBe(1);
      expect(list.body.data[0].id).toBe(recipe);
    });
    it("enforces owner rights and validates duplicate ingredients", async () => {
      expect(
        (
          await request(app)
            .put(`/api/v1/recipes/${recipe}`)
            .auth(otherToken, { type: "bearer" })
            .send(payload())
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .delete(`/api/v1/recipes/${recipe}`)
            .auth(otherToken, { type: "bearer" })
        ).status,
      ).toBe(403);
      const bad = payload();
      bad.ingredients.push(bad.ingredients[0]);
      expect(
        (
          await request(app)
            .post("/api/v1/recipes")
            .auth(memberToken, { type: "bearer" })
            .send(bad)
        ).status,
      ).toBe(400);
    });
    it("rolls back a failed update and protects referenced taxonomy", async () => {
      const bad = payload();
      bad.title = "Should roll back";
      bad.ingredients[0].ingredient_id = 4294967295;
      expect(
        (
          await request(app)
            .put(`/api/v1/recipes/${recipe}`)
            .auth(memberToken, { type: "bearer" })
            .send(bad)
        ).status,
      ).toBe(409);
      const r = await request(app).get(`/api/v1/recipes/${recipe}`);
      expect(r.body.data.title).toBe("Taco test");
      expect(r.body.data.steps).toHaveLength(2);
      expect(r.body.data.ingredients).toHaveLength(1);
      for (const [table, id] of [
        ["categories", category],
        ["ingredients", ingredient],
      ])
        expect(
          (
            await request(app)
              .delete(`/api/v1/${table}/${id}`)
              .auth(adminToken, { type: "bearer" })
          ).status,
        ).toBe(409);
    });
    it("owner replaces children; admin deletes recipe and children cascade", async () => {
      const p = payload();
      p.title = "Updated";
      p.steps = ["Only one step"];
      expect(
        (
          await request(app)
            .put(`/api/v1/recipes/${recipe}`)
            .auth(memberToken, { type: "bearer" })
            .send(p)
        ).body.data.steps,
      ).toHaveLength(1);
      expect(
        (
          await request(app)
            .delete(`/api/v1/recipes/${recipe}`)
            .auth(adminToken, { type: "bearer" })
        ).status,
      ).toBe(204);
      expect((await request(app).get(`/api/v1/recipes/${recipe}`)).status).toBe(
        404,
      );
      const [rows] = await pool.query<any[]>(
        "SELECT COUNT(*) AS n FROM recipe_steps WHERE recipe_id=?",
        [recipe],
      );
      expect(rows[0].n).toBe(0);
      for (const [table, id] of [
        ["categories", category],
        ["ingredients", ingredient],
      ])
        expect(
          (
            await request(app)
              .delete(`/api/v1/${table}/${id}`)
              .auth(adminToken, { type: "bearer" })
          ).status,
        ).toBe(204);
    });
    it("readiness checks real database", async () => {
      expect((await request(app).get("/health/ready")).status).toBe(200);
    });
  },
);
afterAll(async () => {
  await pool.end();
});
