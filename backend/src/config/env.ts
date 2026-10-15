import "dotenv/config";
import { z } from "zod";
export const env = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(3000),
    DB_HOST: z.string().default("localhost"),
    DB_PORT: z.coerce.number().default(3306),
    DB_USER: z.string().default("cookshare"),
    DB_PASSWORD: z.string().min(1),
    DB_NAME: z
      .string()
      .regex(/^[a-zA-Z0-9_]+$/)
      .default("cookshare"),
    JWT_SECRET: z.string().min(32),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),
  })
  .parse(process.env);
