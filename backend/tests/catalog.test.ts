import { describe, it, expect } from "vitest";
import { readFile, access } from "node:fs/promises";
describe("expanded recipe catalog", () => {
  it("adds 20 unique complete recipes per category without replacing existing titles", async () => {
    const base = JSON.parse(
      await readFile(
        new URL("../../database/seeds/recipes.json", import.meta.url),
        "utf8",
      ),
    );
    const extra = JSON.parse(
      await readFile(
        new URL("../../database/seeds/recipes-extra.json", import.meta.url),
        "utf8",
      ),
    );
    expect(extra).toHaveLength(120);
    const all = [...base, ...extra];
    expect(new Set(all.map((r) => r.title)).size).toBe(all.length);
    const counts: Record<string, number> = {};
    for (const r of extra) {
      counts[r.category] = (counts[r.category] ?? 0) + 1;
      expect(r.title.length).toBeGreaterThan(5);
      expect(r.description.length).toBeGreaterThan(30);
      expect(r.prep).toBeGreaterThanOrEqual(0);
      expect(r.cook).toBeGreaterThanOrEqual(0);
      expect(r.servings).toBeGreaterThan(0);
      expect(r.ingredients.length).toBeGreaterThanOrEqual(2);
      expect(new Set(r.ingredients.map((i: any[]) => i[0])).size).toBe(
        r.ingredients.length,
      );
      for (const [name, quantity, unit] of r.ingredients) {
        expect(name).toBeTruthy();
        expect(quantity).toBeGreaterThan(0);
        expect(unit).toBeTruthy();
      }
      expect(r.steps.length).toBeGreaterThanOrEqual(3);
      expect(r.steps.every((s: string) => s.length > 15)).toBe(true);
      await access(
        new URL(`../../frontend/public/images/${r.image}.jpg`, import.meta.url),
      );
    }
    expect(counts).toEqual({
      "Bữa sáng": 20,
      "Đồ uống": 20,
      "Món chay": 20,
      "Món chính": 20,
      Salad: 20,
      "Tráng miệng": 20,
    });
  });
});
