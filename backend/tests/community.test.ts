import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import sharp from "sharp";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
process.env.DB_PASSWORD ??= "test-db-password";
process.env.JWT_SECRET ??= "test-only-secret-with-at-least-32-characters";
process.env.UPLOAD_DIR = resolve("uploads-test");
const { app } = await import("../src/app.js");
const { pool } = await import("../src/config/db.js");
describe.skipIf(process.env.RUN_DB_TESTS !== "1")(
  "Community, account, administration and upload integration",
  () => {
    let token: string,
      other: string,
      admin: string,
      id: number,
      userId: number,
      commentId: number,
      category: number,
      ingredient: number,
      imagePath: string;
    const suffix = Date.now(),
      email = `community${suffix}@test.local`,
      otherEmail = `community-other${suffix}@test.local`;
    const password = "community-password123";
    const auth = (r: any, t = token) => r.auth(t, { type: "bearer" });
    beforeAll(async () => {
      if (!process.env.DB_NAME?.endsWith("_test"))
        throw Error("Dedicated _test DB required");
      const a = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "admin@cookshare.local",
          password: process.env.SEED_ADMIN_PASSWORD,
        });
      expect(a.status).toBe(200);
      admin = a.body.data.access_token;
      for (const e of [email, otherEmail]) {
        expect(
          (
            await request(app)
              .post("/api/v1/auth/register")
              .send({ name: "Community test", email: e, password })
          ).status,
        ).toBe(201);
        const l = await request(app)
          .post("/api/v1/auth/login")
          .send({ email: e, password });
        expect(l.status).toBe(200);
        if (e === email) {
          token = l.body.data.access_token;
          userId = l.body.data.user.id;
        } else other = l.body.data.access_token;
      }
      const [c] = await pool.query<any[]>("SELECT id FROM categories LIMIT 1");
      category = c[0].id;
      const [i] = await pool.query<any[]>("SELECT id FROM ingredients LIMIT 1");
      ingredient = i[0].id;
      const recipe = await auth(request(app).post("/api/v1/recipes")).send({
        title: `Community recipe ${suffix}`,
        description: "Complete integration recipe",
        category_id: category,
        prep_minutes: 5,
        cook_minutes: 10,
        servings: 2,
        difficulty: "easy",
        ingredients: [{ ingredient_id: ingredient, quantity: 1, unit: "g" }],
        steps: ["Prepare", "Cook"],
      });
      expect(recipe.status).toBe(201);
      id = recipe.body.data.id;
    }, 30000);
    afterAll(async () => {
      if (process.env.DB_NAME?.endsWith("_test")) {
        if (id) await pool.query("DELETE FROM recipes WHERE id=?", [id]);
        await pool.query("DELETE FROM users WHERE email IN (?,?)", [
          email,
          otherEmail,
        ]);
      }
      if (imagePath)
        await rm(
          resolve(process.env.UPLOAD_DIR!, imagePath.split("/").pop()!),
          { force: true },
        );
      await pool.end();
    });
    it("persists profile and rejects privilege escalation", async () => {
      const r = await auth(request(app).put("/api/v1/auth/me")).send({
        name: "Updated cook",
        bio: "Love cooking",
      });
      expect(r.status).toBe(200);
      expect(
        (await auth(request(app).get("/api/v1/auth/me"))).body.data.bio,
      ).toBe("Love cooking");
      expect(
        (
          await auth(request(app).put("/api/v1/auth/me")).send({
            name: "Bad",
            role: "admin",
          })
        ).status,
      ).toBe(400);
    });
    it("members can add a missing ingredient but cannot modify shared taxonomy", async () => {
      const created=await auth(request(app).post('/api/v1/ingredients')).send({name:`new ingredient ${suffix}`});
      expect(created.status).toBe(201);
      const ingredientId=created.body.data.id;
      try {
        expect((await auth(request(app).put(`/api/v1/ingredients/${ingredientId}`)).send({name:'Unauthorized rename'})).status).toBe(403);
        expect((await auth(request(app).delete(`/api/v1/ingredients/${ingredientId}`))).status).toBe(403);
      } finally { await pool.query('DELETE FROM ingredients WHERE id=?',[ingredientId]); }
    });
    it("favorites are idempotent, stored in MySQL and listed with pagination", async () => {
      for (let i = 0; i < 2; i++)
        expect(
          (await auth(request(app).put(`/api/v1/recipes/${id}/favorite`)))
            .status,
        ).toBe(204);
      const [r] = await pool.query<any[]>(
        "SELECT COUNT(*) AS n FROM favorites WHERE user_id=? AND recipe_id=?",
        [userId, id],
      );
      expect(r[0].n).toBe(1);
      const saved = await auth(request(app).get("/api/v1/me/saved?limit=1"));
      expect(saved.body.pagination.total).toBe(1);
      expect(saved.body.data[0].id).toBe(id);
      expect(
        (await auth(request(app).get(`/api/v1/recipes/${id}/interactions`)))
          .body.data.favorite,
      ).toBe(true);
      expect(
        (await auth(request(app).delete(`/api/v1/recipes/${id}/favorite`)))
          .status,
      ).toBe(204);
      expect(
        (await auth(request(app).get("/api/v1/me/favorites"))).body.data,
      ).toEqual([]);
    });
    it("ratings upsert one per user, validate range and compute average", async () => {
      for (const score of [4, 5])
        expect(
          (
            await auth(request(app).put(`/api/v1/recipes/${id}/rating`)).send({
              score,
            })
          ).status,
        ).toBe(200);
      await auth(request(app).put(`/api/v1/recipes/${id}/rating`), other).send({
        score: 3,
      });
      expect(
        (
          await auth(request(app).put(`/api/v1/recipes/${id}/rating`)).send({
            score: 6,
          })
        ).status,
      ).toBe(400);
      const r = await request(app).get(`/api/v1/recipes/${id}`);
      expect(Number(r.body.data.average_rating)).toBe(4);
      expect(r.body.data.rating_count).toBe(2);
    });
    it("comments add/edit/delete and enforce ownership", async () => {
      const r = await auth(
        request(app).post(`/api/v1/recipes/${id}/comments`),
      ).send({ content: "Very good" });
      expect(r.status).toBe(201);
      commentId = r.body.data.id;
      expect(
        (
          await auth(
            request(app).put(`/api/v1/comments/${commentId}`),
            other,
          ).send({ content: "Not mine" })
        ).status,
      ).toBe(404);
      expect(
        (
          await auth(
            request(app).delete(`/api/v1/comments/${commentId}`),
            other,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await auth(request(app).put(`/api/v1/comments/${commentId}`)).send({
            content: "Updated comment",
          })
        ).status,
      ).toBe(200);
      const list = await request(app).get(
        `/api/v1/recipes/${id}/comments?limit=1`,
      );
      expect(list.body.data[0].content).toBe("Updated comment");
      expect(list.body.pagination.total).toBe(1);
      expect(
        (await auth(request(app).delete(`/api/v1/comments/${commentId}`)))
          .status,
      ).toBe(204);
    });
    it("ingredient/time/difficulty filters and stable sorts work", async () => {
      const injection=await request(app).get('/api/v1/recipes').query({q:"' OR 1=1 --"});
      expect(injection.status).toBe(200);expect(injection.body.pagination.total).toBe(0);
      const [i] = await pool.query<any[]>(
        "SELECT name FROM ingredients WHERE id=?",
        [ingredient],
      );
      const list = await request(app)
        .get("/api/v1/recipes")
        .query({
          q: String(suffix),
          ingredient: i[0].name,
          max_minutes: 15,
          difficulty: "easy",
          sort: "rating",
        });
      expect(list.body.data.map((r: any) => r.id)).toContain(id);
      expect(
        (
          await request(app)
            .get("/api/v1/recipes")
            .query({ q: String(suffix), max_minutes: 10 })
        ).body.pagination.total,
      ).toBe(0);
      expect(
        (await request(app).get("/api/v1/recipes?sort=unsafe")).status,
      ).toBe(400);
    });
    it("admin API denies members, moderates visibility and reports real counts", async () => {
      for (const p of ["stats", "users", "recipes", "comments"])
        expect(
          (await auth(request(app).get(`/api/v1/admin/${p}`))).status,
        ).toBe(403);
      const stats = await auth(request(app).get("/api/v1/admin/stats"), admin);
      expect(stats.status).toBe(200);
      const [counts] = await pool.query<any[]>(
        "SELECT COUNT(*) AS total FROM recipes",
      );
      expect(stats.body.data.recipes).toBe(counts[0].total);
      expect(
        (
          await auth(
            request(app).patch(`/api/v1/admin/recipes/${id}/status`),
            admin,
          ).send({ status: "hidden" })
        ).status,
      ).toBe(200);
      expect((await request(app).get(`/api/v1/recipes/${id}`)).status).toBe(
        404,
      );
      expect(
        (await request(app).get(`/api/v1/recipes?q=${suffix}`)).body.pagination
          .total,
      ).toBe(0);
      expect(
        (await auth(request(app).get(`/api/v1/recipes/${id}`))).status,
      ).toBe(200);
      expect(
        (await auth(request(app).get("/api/v1/me/recipes"))).body.data.map(
          (r: any) => r.id,
        ),
      ).toContain(id);
      expect(
        (
          await auth(
            request(app).patch(`/api/v1/admin/recipes/${id}/status`),
            admin,
          ).send({ status: "published" })
        ).status,
      ).toBe(200);
    });
    it("uploads verify actual content, size, MIME and reencode images", async () => {
      expect((await request(app).post("/api/v1/uploads")).status).toBe(401);
      expect(
        (
          await auth(request(app).post("/api/v1/uploads")).attach(
            "image",
            Buffer.from("<svg></svg>"),
            { filename: "bad.svg", contentType: "image/svg+xml" },
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await auth(request(app).post("/api/v1/uploads")).attach(
            "image",
            Buffer.from("not an image"),
            { filename: "fake.jpg", contentType: "image/jpeg" },
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await auth(request(app).post("/api/v1/uploads")).attach(
            "image",
            Buffer.alloc(5 * 1024 * 1024 + 1),
            { filename: "large.jpg", contentType: "image/jpeg" },
          )
        ).status,
      ).toBe(413);
      const buffer = await sharp({
        create: { width: 32, height: 32, channels: 3, background: "#e8a027" },
      })
        .png()
        .toBuffer();
      const r = await auth(request(app).post("/api/v1/uploads")).attach(
        "image",
        buffer,
        { filename: "good.png", contentType: "image/png" },
      );
      expect(r.status).toBe(201);
      imagePath = r.body.data.url;
      expect(imagePath).toMatch(/^\/uploads\/[a-f0-9-]+\.webp$/);
      const served = await request(app).get(imagePath);
      expect(served.status).toBe(200);
      expect(served.headers["content-type"]).toMatch(/webp/);
    });
    it("admin disables users and old sessions stop working", async () => {
      expect(
        (
          await auth(
            request(app).patch(`/api/v1/admin/users/${userId}`),
            admin,
          ).send({ role: "member", active: false })
        ).status,
      ).toBe(200);
      expect((await auth(request(app).get("/api/v1/auth/me"))).status).toBe(
        401,
      );
      expect(
        (
          await request(app)
            .post("/api/v1/auth/login")
            .send({ email, password })
        ).status,
      ).toBe(401);
      await auth(
        request(app).patch(`/api/v1/admin/users/${userId}`),
        admin,
      ).send({ role: "member", active: true });
      const l = await request(app)
        .post("/api/v1/auth/login")
        .send({ email, password });
      token = l.body.data.access_token;
      expect(l.status).toBe(200);
    });
    it("password change and logout revoke tokens", async () => {
      expect(
        (
          await auth(request(app).put("/api/v1/auth/password")).send({
            current_password: "wrong",
            password: "new-password123",
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await auth(request(app).put("/api/v1/auth/password")).send({
            current_password: password,
            password: "new-password123",
          })
        ).status,
      ).toBe(204);
      expect((await auth(request(app).get("/api/v1/auth/me"))).status).toBe(
        401,
      );
      expect(
        (
          await request(app)
            .post("/api/v1/auth/login")
            .send({ email, password })
        ).status,
      ).toBe(401);
      const login = await request(app)
        .post("/api/v1/auth/login")
        .send({ email, password: "new-password123" });
      expect(login.status).toBe(200);
      token = login.body.data.access_token;
      expect(
        (await auth(request(app).post("/api/v1/auth/logout"))).status,
      ).toBe(204);
      expect((await auth(request(app).get("/api/v1/auth/me"))).status).toBe(
        401,
      );
    });
    it("Prometheus exposes process and HTTP metrics", async () => {
      const r = await request(app).get("/metrics");
      expect(r.status).toBe(200);
      expect(r.text).toContain("cookshare_http_requests_total");
      expect(r.text).toContain("cookshare_process_cpu_user_seconds_total");
    });
  },
);
