import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, Eye, Upload, ArrowLeft } from "lucide-react";
import { api, uploadImage } from "../services/api";
import type { Recipe, Category } from "../types";
type Item = { ingredient_id: number; quantity: number; unit: string };
export function Editor({
  recipe,
  categories,
  saved,
  cancel,
}: {
  recipe: Recipe | null;
  categories: Category[];
  saved: (r: Recipe) => void;
  cancel: () => void;
}) {
  const [ingredients, setIngredients] = useState<Category[]>([]),
    [title, setTitle] = useState(recipe?.title || ""),
    [description, setDescription] = useState(recipe?.description || ""),
    [category, setCategory] = useState(
      recipe?.category_id || categories[0]?.id || 0,
    ),
    [image, setImage] = useState(recipe?.image_url || ""),
    [items, setItems] = useState<Item[]>(
      recipe?.ingredients?.map((i) => ({
        ingredient_id: i.ingredient_id,
        quantity: Number(i.quantity),
        unit: i.unit,
      })) || [{ ingredient_id: 0, quantity: 100, unit: "g" }],
    ),
    [steps, setSteps] = useState(
      recipe?.steps?.map((s) => s.instruction) || [""],
    ),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [prep, setPrep] = useState(recipe?.prep_minutes ?? 15),
    [cook, setCook] = useState(recipe?.cook_minutes ?? 20),
    [servings, setServings] = useState(recipe?.servings ?? 4),
    [difficulty, setDifficulty] = useState(recipe?.difficulty || "easy");
  useEffect(() => {
    api<{ data: Category[] }>("/ingredients")
      .then((r) => setIngredients(r.data))
      .catch((e) => setError(e.message));
  }, []);
  const [newIngredient, setNewIngredient] = useState("");
  async function addIngredient() {
    if (!newIngredient.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ data: Category }>("/ingredients", {
        method: "POST",
        body: JSON.stringify({ name: newIngredient.trim() }),
      });
      setIngredients((v) =>
        [...v, r.data].sort((a, b) => a.name.localeCompare(b.name, "vi")),
      );
      setItems((v) => {
        const empty = v.findIndex((i) => !i.ingredient_id);
        return empty < 0
          ? [...v, { ingredient_id: r.data.id, quantity: 1, unit: "g" }]
          : v.map((item, i) =>
              i === empty ? { ...item, ingredient_id: r.data.id } : item,
            );
      });
      setNewIngredient("");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const payload = () => ({
    title,
    description,
    category_id: category,
    image_url: image || null,
    prep_minutes: prep,
    cook_minutes: cook,
    servings,
    difficulty,
    ingredients: items,
    steps,
  });
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (new Set(items.map((i) => i.ingredient_id)).size !== items.length) {
      setError("Mỗi nguyên liệu chỉ được chọn một lần.");
      return;
    }
    if (!preview) {
      setPreview(true);
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ data: Recipe }>(
        recipe ? `/recipes/${recipe.id}` : "/recipes",
        { method: recipe ? "PUT" : "POST", body: JSON.stringify(payload()) },
      );
      saved(r.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function changeItem(i: number, patch: Partial<Item>) {
    setItems((v) => v.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }
  return (
    <section className="editor page-section">
      <button className="back-button" onClick={cancel}>
        <ArrowLeft size={15} />
        Quay lại
      </button>
      <div className="eyebrow">CHIA SẺ TỪ CĂN BẾP CỦA BẠN</div>
      <h1>
        {recipe ? "Chỉnh sửa" : "Thêm"} <em>công thức.</em>
      </h1>
      <form onSubmit={submit} className="panel form-panel">
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {preview ? (
          <div className="editor-preview">
            <span className="eyebrow">XEM TRƯỚC · CHƯA ĐĂNG</span>
            {image && <img src={image} alt={title} />}
            <h2>{title}</h2>
            <p>{description}</p>
            <p>
              {categories.find((c) => c.id === category)?.name} · {prep + cook}{" "}
              phút · {servings} người
            </p>
            <h3>Nguyên liệu</h3>
            <ul>
              {items.map((i, j) => (
                <li key={j}>
                  {ingredients.find((x) => x.id === i.ingredient_id)?.name}:{" "}
                  {i.quantity} {i.unit}
                </li>
              ))}
            </ul>
            <h3>Cách làm</h3>
            <ol>
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        ) : (
          <>
            <label>
              Tên món ăn
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
                placeholder="Một món ngon bạn muốn chia sẻ…"
              />
            </label>
            <label>
              Mô tả
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={10000}
                required
                rows={3}
              />
            </label>
            <label className="upload-control">
              <Upload size={19} />{" "}
              {busy
                ? "Đang tải ảnh…"
                : "Tải ảnh món ăn (JPEG, PNG, WebP · tối đa 5 MB)"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  try {
                    setImage(await uploadImage(file));
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
            {image && (
              <img
                className="upload-preview"
                src={image}
                alt="Ảnh món ăn đã tải"
              />
            )}
            <div className="form-grid">
              <label>
                Danh mục
                <select
                  required
                  value={category}
                  onChange={(e) => setCategory(Number(e.target.value))}
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Độ khó
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="easy">Dễ thực hiện</option>
                  <option value="medium">Vừa sức</option>
                  <option value="hard">Thử thách</option>
                </select>
              </label>
              <label>
                Chuẩn bị (phút)
                <input
                  type="number"
                  required
                  min={0}
                  max={10080}
                  value={prep}
                  onChange={(e) => setPrep(Number(e.target.value))}
                />
              </label>
              <label>
                Chế biến (phút)
                <input
                  type="number"
                  required
                  min={0}
                  max={10080}
                  value={cook}
                  onChange={(e) => setCook(Number(e.target.value))}
                />
              </label>
              <label>
                Khẩu phần (người)
                <input
                  type="number"
                  required
                  min={1}
                  max={1000}
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value))}
                />
              </label>
            </div>
            <h3>Nguyên liệu & định lượng</h3>
            {items.map((item, i) => (
              <div className="ingredient-row" key={i}>
                <select
                  required
                  aria-label={`Nguyên liệu ${i + 1}`}
                  value={item.ingredient_id || ""}
                  onChange={(e) =>
                    changeItem(i, { ingredient_id: Number(e.target.value) })
                  }
                >
                  <option value="">Chọn nguyên liệu</option>
                  {ingredients.map((x) => (
                    <option value={x.id} key={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Số lượng ${i + 1}`}
                  type="number"
                  step="0.001"
                  min="0.001"
                  max="9999999.999"
                  value={item.quantity}
                  onChange={(e) =>
                    changeItem(i, { quantity: Number(e.target.value) })
                  }
                  required
                />
                <input
                  aria-label={`Đơn vị ${i + 1}`}
                  placeholder="g, ml, quả…"
                  maxLength={30}
                  value={item.unit}
                  onChange={(e) => changeItem(i, { unit: e.target.value })}
                  required
                />
                <button
                  type="button"
                  aria-label="Xóa nguyên liệu"
                  disabled={items.length === 1}
                  onClick={() => setItems((v) => v.filter((_, j) => j !== i))}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            <button
              className="add-row"
              type="button"
              disabled={items.length >= 100}
              onClick={() =>
                setItems((v) => [
                  ...v,
                  { ingredient_id: 0, quantity: 1, unit: "g" },
                ])
              }
            >
              <Plus size={16} />
              Thêm nguyên liệu
            </button>
            <div className="new-ingredient">
              <input
                aria-label="Tên nguyên liệu mới"
                placeholder="Chưa có nguyên liệu bạn cần? Thêm tên mới…"
                maxLength={100}
                value={newIngredient}
                onChange={(e) => setNewIngredient(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || !newIngredient.trim()}
                onClick={addIngredient}
              >
                Thêm nguyên liệu mới
              </button>
            </div>
            <h3>Các bước chế biến</h3>
            {steps.map((s, i) => (
              <div className="step-row" key={i}>
                <b>{String(i + 1).padStart(2, "0")}</b>
                <textarea
                  required
                  maxLength={5000}
                  value={s}
                  rows={2}
                  placeholder={`Mô tả bước ${i + 1}`}
                  onChange={(e) =>
                    setSteps((v) =>
                      v.map((x, j) => (j === i ? e.target.value : x)),
                    )
                  }
                />
                <button
                  type="button"
                  aria-label="Xóa bước"
                  disabled={steps.length === 1}
                  onClick={() => setSteps((v) => v.filter((_, j) => j !== i))}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            <button
              className="add-row"
              type="button"
              disabled={steps.length >= 100}
              onClick={() => setSteps((v) => [...v, ""])}
            >
              <Plus size={16} />
              Thêm bước
            </button>
          </>
        )}
        <div className="form-actions">
          {preview && (
            <button type="button" onClick={() => setPreview(false)}>
              Tiếp tục chỉnh sửa
            </button>
          )}
          <button className="dark-button" disabled={busy}>
            {preview ? (
              busy ? (
                "Đang lưu…"
              ) : recipe ? (
                "Lưu thay đổi"
              ) : (
                "Đăng công thức"
              )
            ) : (
              <>
                <Eye size={17} />
                Xem trước công thức
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
