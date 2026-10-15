import { z } from "zod";
export const idSchema = z.coerce.number().int().positive().max(4294967295);
export const taxonomySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(5000).nullable().optional(),
  })
  .strict();
export const imageSchema = z
  .string()
  .max(2048)
  .refine(
    (v) =>
      /^\/uploads\/[a-f0-9-]+\.webp$/.test(v) ||
      /^\/images\/[a-z-]+\.jpg$/.test(v) ||
      /^https?:\/\//.test(v),
    "Invalid image URL",
  );
export const recipeSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10000),
    category_id: idSchema,
    image_url: imageSchema.nullable().optional(),
    prep_minutes: z.number().int().min(0).max(10080),
    cook_minutes: z.number().int().min(0).max(10080),
    servings: z.number().int().min(1).max(1000),
    difficulty: z.enum(["easy", "medium", "hard"]),
    ingredients: z
      .array(
        z
          .object({
            ingredient_id: idSchema,
            quantity: z.number().positive().max(9999999.999).multipleOf(0.001),
            unit: z.string().trim().min(1).max(30),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    steps: z.array(z.string().trim().min(1).max(5000)).min(1).max(100),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.ingredients.map((i) => i.ingredient_id)).size ===
      v.ingredients.length,
    { message: "Duplicate ingredient" },
  );
export type RecipeInput = z.infer<typeof recipeSchema>;
