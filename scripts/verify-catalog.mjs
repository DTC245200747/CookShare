import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.BASE_URL || "http://localhost:3000";
const extra = JSON.parse(
  await readFile(
    new URL("../database/seeds/recipes-extra.json", import.meta.url),
    "utf8",
  ),
);
async function get(path) {
  const response = await fetch(`${base}/api/v1${path}`);
  assert.equal(response.status, 200, path);
  return response.json();
}
const categories = (await get("/categories?limit=100")).data;
let verified = 0;
for (const name of [...new Set(extra.map((r) => r.category))]) {
  const category = categories.find((c) => c.name === name);
  assert.ok(category, name);
  const list = await get(`/recipes?category_id=${category.id}&limit=100`);
  const expected = extra.filter((r) => r.category === name);
  assert.equal(expected.length, 20);
  for (const item of expected) {
    const matches = list.data.filter((r) => r.title === item.title);
    assert.equal(matches.length, 1, item.title);
    const { data: detail } = await get(`/recipes/${matches[0].id}`);
    assert.equal(
      detail.ingredients.length,
      item.ingredients.length,
      item.title,
    );
    assert.deepEqual(
      detail.steps.map((s) => s.instruction),
      item.steps,
      item.title,
    );
    assert.equal(detail.prep_minutes, item.prep, item.title);
    assert.equal(detail.cook_minutes, item.cook, item.title);
    verified++;
  }
  console.log(
    `${name}: ${list.pagination.total} total, 20 new recipes verified`,
  );
}
assert.equal(verified, 120);
console.log(
  `Verified ${verified} new recipes through live API; total recipes: ${(await get("/recipes?limit=1")).pagination.total}`,
);
