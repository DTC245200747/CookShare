import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { authenticate } from "../middleware/auth.js";
import { ApiError } from "../middleware/errors.js";
import rateLimit from "express-rate-limit";
export const uploadDirectory = resolve(process.env.UPLOAD_DIR || "uploads");
export const uploads = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
      return cb(
        new ApiError(400, "Only JPEG, PNG and WebP images are allowed"),
      );
    cb(null, true);
  },
});
uploads.post(
  "/",
  authenticate,
  rateLimit({ windowMs: 60000, limit: 10 }),
  upload.single("image"),
  async (req, res) => {
    if (!req.file) throw new ApiError(400, "Image is required");
    let output: Buffer;
    try {
      const image = sharp(req.file.buffer, {
        limitInputPixels: 25000000,
        animated: false,
      });
      const meta = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(meta.format || "")) throw Error();
      output = await image
        .rotate()
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new ApiError(
        400,
        "Invalid image or image dimensions are too large",
      );
    }
    await mkdir(uploadDirectory, { recursive: true });
    const name = randomUUID() + ".webp";
    await sharp(output).toFile(resolve(uploadDirectory, name));
    res.status(201).json({ data: { url: "/uploads/" + name } });
  },
);
