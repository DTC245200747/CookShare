import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Search,
  UserRound,
  Heart,
  Clock,
  ChefHat,
  Users,
  Flame,
  Leaf,
  Utensils,
  Star,
  BookOpen,
  Menu,
  ChevronLeft,
  Pencil,
  Trash2,
  Plus,
  LayoutDashboard,
} from "lucide-react";
import type { Recipe, Category, User, Page } from "./types";
import { api } from "./services/api";
import { Auth } from "./components/Auth";
import { Pagination, Confirm, Skeleton, Toast } from "./components/UI";
import { Community } from "./components/Community";
import { Editor } from "./pages/Editor";
import { Profile } from "./pages/Profile";
import { Admin } from "./pages/Admin";
const photo = (name: string) => `/images/${name}.jpg`;
export default function App() {
  const [page, setPage] = useState(() => location.hash.slice(1) || "home"),
    [recipes, setRecipes] = useState<Recipe[]>([]),
    [popular, setPopular] = useState<Recipe[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [category, setCategory] = useState(0),
    [search, setSearch] = useState(""),
    [ingredient, setIngredient] = useState(""),
    [difficulty, setDifficulty] = useState(""),
    [minutes, setMinutes] = useState(""),
    [sort, setSort] = useState("newest"),
    [currentPage, setCurrentPage] = useState(1),
    [total, setTotal] = useState(0),
    [selected, setSelected] = useState<Recipe | null>(null),
    [editing, setEditing] = useState<Recipe | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [user, setUser] = useState<User | null>(null),
    [mobile, setMobile] = useState(false),
    [favorites, setFavorites] = useState<number[]>([]),
    [checked, setChecked] = useState<number[]>([]),
    [version, setVersion] = useState(0),
    [toast, setToast] = useState(""),
    [remove, setRemove] = useState<Recipe | null>(null),
    [busy, setBusy] = useState(false),
    [favoriteBusy, setFavoriteBusy] = useState(false);
  const limit = page === "home" ? 6 : 9;
  const notify = (message: string) => setToast(message);
  function go(p: string) {
    location.hash = p;
    setPage(p);
    setSelected(null);
    setMobile(false);
    setSearch("");
    setCategory(0);
    setIngredient("");
    setDifficulty("");
    setMinutes("");
    setSort("newest");
    setCurrentPage(1);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  useEffect(() => {
    const onHash = () => {
      const p = location.hash.slice(1) || "home";
      const id = p.match(/^recipe\/(\d+)$/)?.[1];
      if (id) {
        if (selected?.id !== Number(id)) openRecipe(Number(id));
      } else {
        setPage(
          [
            "home",
            "recipes",
            "favorites",
            "mine",
            "editor",
            "profile",
            "admin",
          ].includes(p)
            ? p
            : "home",
        );
        setSelected(null);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [selected?.id]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const expired = () => {
      setUser(null);
      setFavorites([]);
      setAuth(true);
      notify("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
    };
    window.addEventListener("session-expired", expired);
    if (sessionStorage.getItem("cookshare-token"))
      api<{ data: User }>("/auth/me")
        .then((r) => setUser(r.data))
        .catch(() => {});
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  useEffect(() => {
    api<{ data: Category[] }>("/categories")
      .then((r) => setCategories(r.data))
      .catch((e) => setError(e.message));
    api<Page<Recipe>>("/recipes?sort=popular&limit=3")
      .then((r) => setPopular(r.data))
      .catch(() => {});
  }, [version]);
  useEffect(() => {
    if (user)
      api<{ data: { recipe_id: number }[] }>("/me/favorites")
        .then((r) => setFavorites(r.data.map((f) => f.recipe_id)))
        .catch((e) => setError(e.message));
    else setFavorites([]);
  }, [user, version]);
  useEffect(() => {
    if (!["home", "recipes", "favorites", "mine"].includes(page)) return;
    if ((page === "favorites" || page === "mine") && !user) {
      setLoading(false);
      setRecipes([]);
      setTotal(0);
      return;
    }
    let current = true;
    setLoading(true);
    const timer = setTimeout(() => {
      const q = new URLSearchParams({
        page: String(currentPage),
        limit: String(limit),
        sort,
      });
      if (category) q.set("category_id", String(category));
      if (search) q.set("q", search);
      if (ingredient) q.set("ingredient", ingredient);
      if (difficulty) q.set("difficulty", difficulty);
      if (minutes) q.set("max_minutes", minutes);
      const path =
        page === "favorites"
          ? "/me/saved"
          : page === "mine"
            ? "/me/recipes"
            : "/recipes";
      api<Page<Recipe>>(path + "?" + q)
        .then((r) => {
          if (current) {
            setRecipes(r.data);
            setTotal(r.pagination.total);
            setError("");
          }
        })
        .catch((e) => {
          if (current) setError(e.message);
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [
    page,
    currentPage,
    limit,
    sort,
    category,
    search,
    ingredient,
    difficulty,
    minutes,
    user,
    version,
  ]);
  useEffect(() => {
    const id = location.hash.match(/^#recipe\/(\d+)$/)?.[1];
    if (id) openRecipe(Number(id));
  }, []);
  async function openRecipe(id: number) {
    setError("");
    setLoading(true);
    try {
      const r = await api<{ data: Recipe }>(`/recipes/${id}`);
      setSelected(r.data);
      setChecked([]);
      setPage("detail");
      location.hash = `recipe/${id}`;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
      setPage("recipes");
    } finally {
      setLoading(false);
    }
  }
  async function refreshDetail() {
    if (selected) {
      try {
        const r = await api<{ data: Recipe }>(`/recipes/${selected.id}`);
        setSelected(r.data);
        setVersion((v) => v + 1);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }
  async function toggle(id: number) {
    if (!user) {
      setAuth(true);
      return;
    }
    if (favoriteBusy) return;
    setFavoriteBusy(true);
    try {
      const saved = favorites.includes(id);
      await api(`/recipes/${id}/favorite`, {
        method: saved ? "DELETE" : "PUT",
      });
      setFavorites((v) => (saved ? v.filter((x) => x !== id) : [...v, id]));
      setVersion((v) => v + 1);
      notify(saved ? "Đã bỏ lưu công thức." : "Đã lưu vào món yêu thích.");
      if (selected?.id === id) {
        const r = await api<{ data: Recipe }>(`/recipes/${id}`);
        setSelected(r.data);
      }
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setFavoriteBusy(false);
    }
  }
  function startEditor(r: Recipe | null) {
    if (!user) {
      setAuth(true);
      return;
    }
    setEditing(r);
    setPage("editor");
    location.hash = "editor";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const canEdit = (r: Recipe) =>
    user && (user.id === r.author_id || user.role === "admin");
  const card = (r: Recipe) => (
    <article className="recipe-card" key={r.id}>
      <div className="card-image">
        <button
          className="image-link"
          onClick={() => openRecipe(r.id)}
          aria-label={`Xem ${r.title}`}
        >
          <img
            src={r.image_url || photo("tacos")}
            alt={r.title}
            loading="lazy"
          />
        </button>
        <span className="time-tag">
          <Clock size={12} />
          {r.prep_minutes + r.cook_minutes} phút
        </span>
        <button
          className={"heart " + (favorites.includes(r.id) ? "saved" : "")}
          aria-pressed={favorites.includes(r.id)}
          disabled={favoriteBusy}
          onClick={() => toggle(r.id)}
          aria-label={
            favorites.includes(r.id) ? `Bỏ lưu ${r.title}` : `Lưu ${r.title}`
          }
        >
          <Heart
            size={17}
            fill={favorites.includes(r.id) ? "currentColor" : "none"}
          />
        </button>
        {r.status === "hidden" && <span className="hidden-tag">Đã ẩn</span>}
      </div>
      <div className="card-body">
        <div className="card-meta">
          <span>{r.category_name}</span>
          <span>
            <Star size={11} fill="currentColor" />
            {Number(r.average_rating) > 0
              ? Number(r.average_rating).toFixed(1)
              : "Chưa đánh giá"}
          </span>
        </div>
        <button className="card-title" onClick={() => openRecipe(r.id)}>
          {r.title}
        </button>
        <div className="card-author">
          <ChefHat size={14} />
          <span>{r.author_name}</span>
        </div>
        <div className="card-bottom">
          <span>
            <ChefHat size={14} />
            {r.difficulty === "easy"
              ? "Dễ thực hiện"
              : r.difficulty === "medium"
                ? "Vừa sức"
                : "Thử thách"}
          </span>
          <span>
            <Heart size={12} />
            {r.favorite_count}
          </span>
          <button onClick={() => openRecipe(r.id)} aria-label="Xem công thức">
            <ArrowUpRight size={20} />
          </button>
        </div>
        {page === "mine" && canEdit(r) && (
          <div className="owner-actions">
            <button
              onClick={async () => {
                try {
                  const data = await api<{ data: Recipe }>(`/recipes/${r.id}`);
                  startEditor(data.data);
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <Pencil size={13} />
              Sửa
            </button>
            <button onClick={() => setRemove(r)}>
              <Trash2 size={13} />
              Xóa
            </button>
          </div>
        )}
      </div>
    </article>
  );
  const tabs = (
    <div className="category-tabs">
      <button
        className={!category ? "chosen" : ""}
        onClick={() => {
          setCategory(0);
          setCurrentPage(1);
        }}
      >
        <Utensils size={15} />
        Tất cả món ngon
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          className={category === c.id ? "chosen" : ""}
          onClick={() => {
            setCategory(c.id);
            setCurrentPage(1);
          }}
        >
          <Leaf size={15} />
          {c.name}
        </button>
      ))}
    </div>
  );
  const grid = loading ? (
    <Skeleton />
  ) : recipes.length ? (
    <>
      <div className="recipe-grid">{recipes.map(card)}</div>
      {page !== "home" && (
        <Pagination
          page={currentPage}
          total={total}
          limit={limit}
          onChange={(n) => {
            setCurrentPage(n);
            window.scrollTo({ top: 220, behavior: "smooth" });
          }}
        />
      )}
    </>
  ) : (
    <div className="empty">
      <ChefHat size={40} />
      <h3>
        {!user && (page === "favorites" || page === "mine")
          ? "Đăng nhập để mở căn bếp của bạn"
          : "Chưa có công thức phù hợp"}
      </h3>
      <p>
        {page === "favorites"
          ? "Lưu những món bạn thích bằng nút trái tim."
          : "Thử bộ lọc khác hoặc chia sẻ công thức đầu tiên."}
      </p>
      <button
        className="dark-button"
        onClick={() =>
          !user && (page === "favorites" || page === "mine")
            ? setAuth(true)
            : go("recipes")
        }
      >
        {!user && (page === "favorites" || page === "mine")
          ? "Đăng nhập"
          : "Khám phá món ngon"}
        <ArrowUpRight size={16} />
      </button>
    </div>
  );
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Đến nội dung chính
      </a>
      <header className="header">
        <div className="nav wrap">
          <button className="logo" onClick={() => go("home")}>
            COOK<span>SHARE</span>
            <i />
          </button>
          <nav
            id="primary-navigation"
            aria-label="Điều hướng chính"
            className={mobile ? "open" : ""}
          >
            {[
              ["home", "Trang chủ"],
              ["recipes", "Công thức"],
              ["favorites", "Yêu thích"],
            ].map(([p, label]) => (
              <button
                key={p}
                className={page === p ? "active" : ""}
                onClick={() => go(p)}
              >
                {label}
              </button>
            ))}
            {user && (
              <button
                className={page === "mine" ? "active" : ""}
                onClick={() => go("mine")}
              >
                Bếp của tôi
              </button>
            )}
            {user?.role === "admin" && (
              <button onClick={() => go("admin")}>
                <LayoutDashboard size={14} /> Quản trị
              </button>
            )}
          </nav>
          <div className="nav-actions">
            <form
              className="nav-search"
              onSubmit={(e) => {
                e.preventDefault();
                setPage("recipes");
                setSelected(null);
                location.hash = "recipes";
                setCurrentPage(1);
              }}
            >
              <input
                aria-label="Tìm công thức"
                placeholder="Hôm nay ăn gì?"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                  if (page !== "recipes") {
                    setPage("recipes");
                    setSelected(null);
                    location.hash = "recipes";
                  }
                }}
              />
              <button aria-label="Tìm kiếm">
                <Search size={17} />
              </button>
            </form>
            <button
              className="account"
              onClick={() => (user ? go("profile") : setAuth(true))}
              aria-label="Tài khoản"
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} />
              ) : (
                <UserRound size={18} />
              )}
            </button>
            <button
              className="mobile-toggle"
              onClick={() => setMobile(!mobile)}
              aria-label="Menu"
              aria-expanded={mobile}
              aria-controls="primary-navigation"
            >
              <Menu />
            </button>
          </div>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className={"wrap " + (page === "admin" ? "admin-wrap" : "")}
      >
        {error && (
          <div className="error" role="alert">
            {error}
            <button onClick={() => setVersion((v) => v + 1)}>Thử lại</button>
          </div>
        )}
        {page === "home" && (
          <>
            <section className="hero">
              <img
                className="hero-photo"
                fetchPriority="high"
                src={photo("hero")}
                alt="Món ăn tươi ngon trên bàn bếp"
              />
              <div className="hero-shade" />
              <div className="hero-content">
                <div className="eyebrow">
                  <span /> MỘT CHÚT CẢM HỨNG, MỘT BỮA ĂN NGON
                </div>
                <h1>
                  Chuyện ngon
                  <br />
                  bắt đầu từ <em>bếp.</em>
                </h1>
                <p>
                  Khám phá những công thức đầy cảm hứng.
                  <br />
                  Nấu bằng đam mê, chia sẻ bằng cả trái tim.
                </p>
                <form
                  className="hero-search"
                  role="search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const query = search;
                    go("recipes");
                    setSearch(query);
                  }}
                >
                  <Search size={20} aria-hidden="true" />
                  <input
                    aria-label="Bạn muốn nấu món gì?"
                    placeholder="Bạn muốn nấu món gì hôm nay?"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button aria-label="Tìm món ngon">
                    <ArrowUpRight size={22} />
                  </button>
                </form>
                <button className="dark-button" onClick={() => go("recipes")}>
                  Khám phá công thức{" "}
                  <span>
                    <ArrowUpRight size={18} />
                  </span>
                </button>
                <div className="hero-foot">
                  <span>
                    <BookOpen size={17} />
                    <b>{loading ? "…" : total}</b> công thức để khám phá
                  </span>
                  <span>
                    <Leaf size={17} />
                    <b>{categories.length || "…"}</b> danh mục hương vị
                  </span>
                </div>
              </div>
              <div className="hero-sticker">
                <ChefHat size={25} />
                <span>
                  CẢM HỨNG MỖI NGÀY
                  <br />
                  <b>Nấu ngon, sống trọn.</b>
                </span>
              </div>
            </section>
            <section className="feature-strip">
              <div>
                <span className="feature-icon">
                  <BookOpen size={21} />
                </span>
                <div>
                  <h3>Công thức dễ theo dõi</h3>
                  <p>Từng bước rõ ràng, ai cũng có thể nấu.</p>
                </div>
              </div>
              <div>
                <span className="feature-icon">
                  <Leaf size={21} />
                </span>
                <div>
                  <h3>Hương vị thật đa dạng</h3>
                  <p>Một chuyến đi ẩm thực ngay tại nhà.</p>
                </div>
              </div>
              <div>
                <span className="feature-icon">
                  <Heart size={21} />
                </span>
                <div>
                  <h3>Chia sẻ niềm vui nấu nướng</h3>
                  <p>Lưu món yêu thích, nấu cho người thương.</p>
                </div>
              </div>
            </section>
            <section className="recipes-section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">TỪ CĂN BẾP COOKSHARE</div>
                  <h2>
                    Món mới <em>cho hôm nay</em>
                  </h2>
                </div>
                <button className="text-link" onClick={() => go("recipes")}>
                  Tất cả công thức <ArrowUpRight size={18} />
                </button>
              </div>
              {tabs}
              {grid}
            </section>
            <section className="cooking-banner" id="community">
              <img
                src={photo("cooking")}
                alt="Nguyên liệu tươi cho bữa ăn tại nhà"
              />
              <div>
                <div className="eyebrow">ÍT CẦU KỲ, NHIỀU NIỀM VUI</div>
                <h2>
                  Đầu bếp giỏi nhất
                  <br />
                  là <em>chính bạn.</em>
                </h2>
                <p>
                  Không cần hoàn hảo. Chỉ cần một chút yêu thích,
                  <br />
                  vài nguyên liệu tươi và một công thức hay.
                </p>
                <button
                  className="dark-button"
                  onClick={() => startEditor(null)}
                >
                  Chia sẻ món ngon{" "}
                  <span>
                    <Plus size={18} />
                  </span>
                </button>
              </div>
              <span className="banner-mark">Made with love ♡</span>
            </section>
            <section className="recipes-section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">THÊM CẢM HỨNG CHO CĂN BẾP</div>
                  <h2>
                    Công thức <em>nổi bật & yêu thích</em>
                  </h2>
                </div>
                <button
                  className="text-link"
                  onClick={() => {
                    go("recipes");
                    setSort("popular");
                  }}
                >
                  Khám phá thêm <ArrowUpRight size={18} />
                </button>
              </div>
              <div className="recipe-grid spaced-grid">{popular.map(card)}</div>
            </section>
          </>
        )}
        {["recipes", "favorites", "mine"].includes(page) && (
          <>
            <section className="listing-hero">
              <div className="eyebrow">CẢM HỨNG CHO MỖI NGÀY</div>
              <h1>
                {page === "favorites"
                  ? "Góc bếp"
                  : page === "mine"
                    ? "Công thức"
                    : "Hôm nay"}{" "}
                <em>
                  {page === "favorites"
                    ? "yêu thích."
                    : page === "mine"
                      ? "của tôi."
                      : "nấu gì?"}
                </em>
              </h1>
              <p>
                {page === "favorites"
                  ? "Những công thức bạn muốn nấu thêm lần nữa."
                  : page === "mine"
                    ? "Chia sẻ một món ngon, gửi đi một niềm vui."
                    : "Một chút khám phá cho bữa ăn thêm thú vị."}
              </p>
              <img src={photo("salad")} alt="Salad tươi" />
            </section>
            <div className="list-toolbar">
              {tabs}
              <button className="dark-button" onClick={() => startEditor(null)}>
                <Plus size={15} />
                Thêm công thức
              </button>
            </div>
            <div className="filter-panel">
              <label>
                <Search size={15} />
                <input
                  aria-label="Tên món ăn"
                  placeholder="Tìm tên món ăn…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </label>
              <input
                aria-label="Tìm theo nguyên liệu"
                placeholder="Nguyên liệu: gà, cà chua…"
                value={ingredient}
                onChange={(e) => {
                  setIngredient(e.target.value);
                  setCurrentPage(1);
                }}
              />
              <select
                aria-label="Độ khó"
                value={difficulty}
                onChange={(e) => {
                  setDifficulty(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">Mọi độ khó</option>
                <option value="easy">Dễ thực hiện</option>
                <option value="medium">Vừa sức</option>
                <option value="hard">Thử thách</option>
              </select>
              <select
                aria-label="Thời gian"
                value={minutes}
                onChange={(e) => {
                  setMinutes(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">Mọi thời gian</option>
                <option value="15">Tối đa 15 phút</option>
                <option value="30">Tối đa 30 phút</option>
                <option value="60">Tối đa 60 phút</option>
              </select>
              <select
                aria-label="Sắp xếp"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="newest">Mới nhất</option>
                <option value="popular">Yêu thích nhất</option>
                <option value="rating">Đánh giá cao nhất</option>
              </select>
            </div>
            <div className="result-count">{total} công thức dành cho bạn</div>
            <section className="listing-grid">{grid}</section>
          </>
        )}
        {page === "detail" && selected && (
          <>
            <button className="back-button" onClick={() => go("recipes")}>
              <ChevronLeft size={17} />
              Tất cả công thức
            </button>
            <section className="detail-hero">
              <div>
                <div className="eyebrow">VÀO BẾP CÙNG COOKSHARE</div>
                <h1>{selected.title}</h1>
                <p>{selected.description}</p>
                <div className="detail-author">
                  <span className="author-avatar">
                    {selected.author_avatar ? (
                      <img src={selected.author_avatar} alt="Tác giả" />
                    ) : (
                      <ChefHat size={23} />
                    )}
                  </span>
                  <span>
                    Công thức từ
                    <br />
                    <b>{selected.author_name}</b>
                  </span>
                </div>
                <div className="detail-rating">
                  <Star size={14} fill="#f4a419" color="#f4a419" />{" "}
                  {Number(selected.average_rating).toFixed(1)}{" "}
                  <span>
                    ({selected.rating_count} đánh giá) ·{" "}
                    {selected.favorite_count} lượt yêu thích
                  </span>
                </div>
              </div>
              <img
                src={selected.image_url || photo("tacos")}
                alt={selected.title}
              />
              <button
                className={
                  "heart " + (favorites.includes(selected.id) ? "saved" : "")
                }
                disabled={favoriteBusy}
                onClick={() => toggle(selected.id)}
                aria-label="Lưu công thức"
              >
                <Heart
                  size={20}
                  fill={
                    favorites.includes(selected.id) ? "currentColor" : "none"
                  }
                />
              </button>
            </section>
            {canEdit(selected) && (
              <div className="detail-owner">
                <button onClick={() => startEditor(selected)}>
                  <Pencil size={15} />
                  Chỉnh sửa công thức
                </button>
                <button onClick={() => setRemove(selected)}>
                  <Trash2 size={15} />
                  Xóa công thức
                </button>
                {selected.status === "hidden" && (
                  <span className="badge hidden">
                    Đang bị ẩn khỏi cộng đồng
                  </span>
                )}
              </div>
            )}
            <div className="recipe-facts">
              {[
                [Users, "Khẩu phần", `${selected.servings} người`],
                [Clock, "Chuẩn bị", `${selected.prep_minutes} phút`],
                [Flame, "Nấu nướng", `${selected.cook_minutes} phút`],
                [
                  ChefHat,
                  "Độ khó",
                  selected.difficulty === "easy"
                    ? "Dễ thực hiện"
                    : selected.difficulty === "medium"
                      ? "Vừa sức"
                      : "Thử thách",
                ],
              ].map(([Icon, label, value]) => {
                const I = Icon as typeof Users;
                return (
                  <div key={String(label)}>
                    <I size={23} />
                    <span>
                      <small>{String(label)}</small>
                      <strong>{String(value)}</strong>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="detail-columns">
              <div>
                <section className="ingredients-box">
                  <div className="section-heading">
                    <h2>
                      Chuẩn bị <em>nguyên liệu</em>
                    </h2>
                    <span>
                      {checked.length}/{selected.ingredients?.length} đã chuẩn
                      bị
                    </span>
                  </div>
                  <p>Chạm để đánh dấu nguyên liệu bạn đã có.</p>
                  <div className="ingredient-list">
                    {selected.ingredients?.map((i) => (
                      <button
                        key={i.ingredient_id}
                        className={
                          checked.includes(i.ingredient_id) ? "checked" : ""
                        }
                        onClick={() =>
                          setChecked((v) =>
                            v.includes(i.ingredient_id)
                              ? v.filter((x) => x !== i.ingredient_id)
                              : [...v, i.ingredient_id],
                          )
                        }
                      >
                        <span className="checkbox">
                          {checked.includes(i.ingredient_id) ? "✓" : ""}
                        </span>
                        <span>{i.name}</span>
                        <strong>
                          {i.quantity} {i.unit}
                        </strong>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="instructions">
                  <div className="eyebrow">TỪNG BƯỚC MỘT</div>
                  <h2>
                    Cùng <em>thực hiện</em>
                  </h2>
                  {selected.steps?.map((s) => (
                    <div className="step" key={s.position}>
                      <b>{String(s.position).padStart(2, "0")}</b>
                      <p>{s.instruction}</p>
                    </div>
                  ))}
                  <div className="enjoy">
                    <ChefHat size={24} />
                    <span>Thành quả đã sẵn sàng. Chúc bạn ngon miệng!</span>
                  </div>
                </section>
                {selected.status !== "hidden" && (
                  <Community
                    key={selected.id}
                    recipeId={selected.id}
                    user={user}
                    login={() => setAuth(true)}
                    notify={notify}
                    changed={refreshDetail}
                  />
                )}
              </div>
              <aside>
                <img src={photo("cooking")} alt="Vào bếp mỗi ngày" />
                <h3>
                  Thêm một chút yêu,
                  <br />
                  thêm nhiều vị ngon.
                </h3>
                <p>Món ngon nhất là món bạn nấu bằng cả trái tim.</p>
                <button className="dark-button" onClick={() => go("recipes")}>
                  Tìm thêm cảm hứng <ArrowUpRight size={17} />
                </button>
              </aside>
            </div>
            <Related recipe={selected} card={card} />
          </>
        )}
        {page === "editor" &&
          (user ? (
            <Editor
              key={editing?.id || "new"}
              recipe={editing}
              categories={categories}
              cancel={() => go("mine")}
              saved={(r) => {
                setVersion((v) => v + 1);
                notify("Đã lưu công thức vào căn bếp của bạn.");
                openRecipe(r.id);
              }}
            />
          ) : (
            <div className="empty">
              <h2>Đăng nhập để chia sẻ món ngon</h2>
              <button className="dark-button" onClick={() => setAuth(true)}>
                Đăng nhập
              </button>
            </div>
          ))}
        {page === "profile" &&
          (user ? (
            <Profile
              key={user.id}
              user={user}
              updated={setUser}
              logout={() => {
                setUser(null);
                go("home");
              }}
              notify={notify}
            />
          ) : (
            <div className="empty">
              <button className="dark-button" onClick={() => setAuth(true)}>
                Đăng nhập để xem hồ sơ
              </button>
            </div>
          ))}
        {page === "admin" &&
          (user?.role === "admin" ? (
            <Admin
              notify={(s) => {
                notify(s);
                setVersion((v) => v + 1);
              }}
              editRecipe={startEditor}
            />
          ) : (
            <div className="empty">
              <h2>Khu vực dành cho quản trị viên</h2>
              <p>Tài khoản của bạn cần có quyền ADMIN để truy cập.</p>
              <button className="dark-button" onClick={() => setAuth(true)}>
                Đăng nhập
              </button>
            </div>
          ))}
      </main>
      <footer>
        <div className="wrap footer-top">
          <div>
            <button className="logo" onClick={() => go("home")}>
              COOK<span>SHARE</span>
              <i />
            </button>
            <p>Nấu bằng đam mê. Chia sẻ bằng trái tim.</p>
          </div>
          <div className="footer-links">
            <button onClick={() => go("recipes")}>Khám phá</button>
            <button onClick={() => go("favorites")}>Yêu thích</button>
            <button onClick={() => (user ? go("profile") : setAuth(true))}>
              Tài khoản
            </button>
            <button className="text-link" onClick={() => startEditor(null)}>
              Chia sẻ công thức <ArrowUpRight size={18} />
            </button>
          </div>
        </div>
        <div className="wrap footer-bottom">
          <span>
            © {new Date().getFullYear()} CookShare. Made for food lovers.
          </span>
          <span>Mỗi công thức, một câu chuyện. ♡</span>
        </div>
      </footer>
      {auth && (
        <Auth
          close={() => setAuth(false)}
          success={(u) => {
            setUser(u);
            setAuth(false);
            notify(`Chào ${u.name}, cùng vào bếp nhé!`);
          }}
        />
      )}
      {toast && <Toast message={toast} close={() => setToast("")} />}{" "}
      {remove && (
        <Confirm
          title={`Xóa “${remove.title}”?`}
          busy={busy}
          onCancel={() => setRemove(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await api(`/recipes/${remove.id}`, { method: "DELETE" });
              setRemove(null);
              setVersion((v) => v + 1);
              notify("Đã xóa công thức.");
              go("mine");
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </>
  );
}
function Related({
  recipe,
  card,
}: {
  recipe: Recipe;
  card: (r: Recipe) => ReactNode;
}) {
  const [items, setItems] = useState<Recipe[]>([]);
  useEffect(() => {
    api<Page<Recipe>>(`/recipes?category_id=${recipe.category_id}&limit=4`)
      .then((r) =>
        setItems(r.data.filter((x) => x.id !== recipe.id).slice(0, 3)),
      )
      .catch(() => {});
  }, [recipe.id, recipe.category_id]);
  return items.length ? (
    <section className="recipes-section">
      <div className="section-heading">
        <h2>
          Có thể bạn <em>cũng thích</em>
        </h2>
      </div>
      <div className="recipe-grid spaced-grid">{items.map(card)}</div>
    </section>
  ) : null;
}
