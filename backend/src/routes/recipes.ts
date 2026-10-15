import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as c from "../controllers/recipes.js";
export const recipes = Router();
recipes.get("/", c.list);
recipes.get(
  "/:id",
  (req, res, next) =>
    req.headers.authorization ? authenticate(req, res, next) : next(),
  c.get,
);
recipes.post("/", authenticate, c.create);
recipes.put("/:id", authenticate, c.update);
recipes.delete("/:id", authenticate, c.remove);
