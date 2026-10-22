import { randomBytes } from "node:crypto";
import { it, expect } from "vitest";
import request from "supertest";
process.env.DB_PASSWORD ??= randomBytes(24).toString("hex");
process.env.JWT_SECRET ??= "test-only-secret-with-at-least-32-characters";
const { app } = await import("../src/app.js");
it("authentication rate limit keeps the JSON error contract without touching MySQL", async () => {
  let response;
  for (let i = 0; i < 31; i++)
    response = await request(app).post("/api/v1/auth/login").send({});
  expect(response!.status).toBe(429);
  expect(response!.headers["content-type"]).toMatch(/application\/json/);
  expect(response!.body.error).toContain("Too many authentication attempts");
  expect(response!.headers["ratelimit"]).toBeTruthy();
});
