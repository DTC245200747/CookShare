import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { env } from "./config/env.js";
import { pool } from "./config/db.js";
import { auth } from "./routes/auth.js";
import { taxonomy } from "./routes/taxonomy.js";
import { recipes } from "./routes/recipes.js";
import { errors } from "./middleware/errors.js";
import { uploads, uploadDirectory } from "./routes/uploads.js";
import { community } from "./routes/community.js";
import { administration } from "./routes/admin.js";
import { authenticate } from "./middleware/auth.js";
import { list } from "./controllers/recipes.js";
import { observe, registry } from "./middleware/observability.js";
export const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(observe);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { imgSrc: ["'self'", "https:", "data:"] },
    },
  }),
  cors({ origin: env.CORS_ORIGIN }),
  express.json({ limit: "100kb" }),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 200,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) =>
      res
        .status(429)
        .json({ error: "Too many requests. Please try again later." }),
  }),
);
app.get("/metrics", async (req, res) => {
  res.type(registry.contentType).send(await registry.metrics());
});
app.get("/health/live", (req, res) => {
  res.json({ status: "ok" });
});
app.get("/health/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});
app.use("/api/v1/auth", auth);
app.use("/api/v1/recipes", recipes);
app.use("/api/v1/categories", taxonomy("categories"));
app.use("/api/v1/ingredients", taxonomy("ingredients"));
app.use("/api/v1/uploads", uploads);
app.use("/api/v1/admin", administration);
app.use("/api/v1", community);
app.get(
  "/api/v1/me/recipes",
  authenticate,
  (req, res, next) => {
    res.locals.mine = true;
    next();
  },
  list,
);
app.get(
  "/api/v1/me/saved",
  authenticate,
  (req, res, next) => {
    res.locals.saved = true;
    next();
  },
  list,
);
app.use(
  "/uploads",
  express.static(uploadDirectory, {
    dotfiles: "deny",
    setHeaders(res) {
      res.setHeader("Content-Security-Policy", "default-src 'none'");
    },
  }),
);
const frontend = fileURLToPath(
  new URL("../../frontend/dist/", import.meta.url),
);
if (existsSync(frontend)) app.use(express.static(frontend));
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});
app.use(errors);
