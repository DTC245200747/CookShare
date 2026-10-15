import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const errors: ErrorRequestHandler = (err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: "Image must be at most 5 MB" });
    return;
  }
  if (err.name === "MulterError") {
    res.status(400).json({ error: "Upload one image using the image field" });
    return;
  }
  if (err instanceof ZodError) {
    res
      .status(400)
      .json({ error: "Validation failed", details: err.flatten() });
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err.code === "ER_DUP_ENTRY") {
    res.status(409).json({ error: "Resource already exists" });
    return;
  }
  if (["ER_ROW_IS_REFERENCED_2", "ER_NO_REFERENCED_ROW_2"].includes(err.code)) {
    res.status(409).json({ error: "Invalid reference or resource is in use" });
    return;
  }
  if (err.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }
  if (err.type === "entity.too.large") {
    res.status(413).json({ error: "Request too large" });
    return;
  }
  console.error({ message: err.message });
  res.status(500).json({ error: "Internal server error" });
};
