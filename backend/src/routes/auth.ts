import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { authenticate } from "../middleware/auth.js";
import { ApiError } from "../middleware/errors.js";
import { imageSchema } from "../services/validation.js";
export const auth = Router();
const credentials = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(10)
    .max(72)
    .refine(
      (v) => Buffer.byteLength(v, "utf8") <= 72,
      "Password must be at most 72 bytes",
    ),
});
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
auth.post("/register", authLimit, async (req, res) => {
  const input = credentials
    .extend({ name: z.string().trim().min(1).max(100) })
    .strict()
    .parse(req.body);
  const hash = await bcrypt.hash(input.password, 12);
  const [result] = await pool.query<any>(
    "INSERT INTO users (name,email,password_hash) VALUES (?,?,?)",
    [input.name, input.email, hash],
  );
  res
    .status(201)
    .json({
      data: {
        id: result.insertId,
        name: input.name,
        email: input.email,
        role: "member",
      },
    });
});
auth.post("/login", authLimit, async (req, res) => {
  const input = credentials.strict().parse(req.body);
  const [rows] = await pool.query<any[]>(
    "SELECT u.*,COALESCE(s.active,1) AS active,COALESCE(s.token_version,0) AS token_version,p.bio,p.avatar_url FROM users u LEFT JOIN user_security s ON s.user_id=u.id LEFT JOIN user_profiles p ON p.user_id=u.id WHERE email=?",
    [input.email],
  );
  const hash =
    rows[0]?.password_hash ??
    "$2b$12$000000000000000000000uGzJ8BqEu85eR2zqLP3aG6I8Q1b9Y3lkO";
  const valid = await bcrypt.compare(input.password, hash);
  if (!rows[0] || !valid || !rows[0].active)
    throw new ApiError(401, "Invalid email or password");
  const { password_hash, ...user } = rows[0];
  res.json({
    data: {
      user,
      access_token: jwt.sign({ v: user.token_version }, env.JWT_SECRET, {
        algorithm: "HS256",
        subject: String(user.id),
        expiresIn: "1h",
        issuer: "cookshare",
        audience: "cookshare-api",
      }),
      token_type: "Bearer",
      expires_in: 3600,
    },
  });
});
auth.get("/me", authenticate, (req, res) => {
  res.json({ data: req.user });
});
auth.put("/me", authenticate, async (req, res) => {
  const input = z
    .object({
      name: z.string().trim().min(1).max(100),
      bio: z.string().trim().max(1000).default(""),
      avatar_url: imageSchema.nullable().optional(),
    })
    .strict()
    .parse(req.body);
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    await c.query("UPDATE users SET name=? WHERE id=?", [
      input.name,
      req.user!.id,
    ]);
    await c.query(
      "INSERT INTO user_profiles(user_id,bio,avatar_url) VALUES (?,?,?) ON DUPLICATE KEY UPDATE bio=VALUES(bio),avatar_url=VALUES(avatar_url)",
      [req.user!.id, input.bio, input.avatar_url ?? null],
    );
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
  res.json({ data: { ...req.user, ...input } });
});
auth.post("/logout", authenticate, async (req, res) => {
  await pool.query(
    "INSERT INTO user_security(user_id,token_version) VALUES (?,1) ON DUPLICATE KEY UPDATE token_version=token_version+1",
    [req.user!.id],
  );
  res.status(204).end();
});
auth.put("/password", authLimit, authenticate, async (req, res) => {
  const input = z
    .object({
      current_password: z.string().min(1).max(72),
      password: credentials.shape.password,
    })
    .strict()
    .parse(req.body);
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const [rows] = await c.query<any[]>(
      "SELECT password_hash FROM users WHERE id=? FOR UPDATE",
      [req.user!.id],
    );
    if (!(await bcrypt.compare(input.current_password, rows[0].password_hash)))
      throw new ApiError(400, "Current password is incorrect");
    await c.query("UPDATE users SET password_hash=? WHERE id=?", [
      await bcrypt.hash(input.password, 12),
      req.user!.id,
    ]);
    await c.query(
      "INSERT INTO user_security(user_id,token_version) VALUES (?,1) ON DUPLICATE KEY UPDATE token_version=token_version+1",
      [req.user!.id],
    );
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
  res.status(204).end();
});
