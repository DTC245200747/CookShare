import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { ApiError } from "./errors.js";
export type User = {
  id: number;
  name: string;
  email: string;
  role: "member" | "admin";
  bio?: string;
  avatar_url?: string;
  token_version?: number;
};
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
export const authenticate: RequestHandler = async (req, res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new ApiError(401, "Authentication required");
  let id: number, version: number;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "cookshare",
      audience: "cookshare-api",
    });
    if (typeof payload === "string" || !payload.sub) throw Error();
    id = Number(payload.sub);
    version = Number(payload.v ?? 0);
    if (!Number.isSafeInteger(id) || id < 1) throw Error();
  } catch {
    throw new ApiError(401, "Invalid or expired token");
  }
  const [users] = await pool.query<any[]>(
    "SELECT u.id,u.name,u.email,u.role,p.bio,p.avatar_url,COALESCE(s.token_version,0) AS token_version,COALESCE(s.active,1) AS active FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id LEFT JOIN user_security s ON s.user_id=u.id WHERE u.id=?",
    [id],
  );
  if (!users[0] || !users[0].active || users[0].token_version !== version)
    throw new ApiError(401, "Session expired. Please log in again");
  req.user = users[0];
  next();
};
export const admin: RequestHandler = (req, res, next) => {
  if (req.user?.role !== "admin")
    throw new ApiError(403, "Admin role required");
  next();
};
