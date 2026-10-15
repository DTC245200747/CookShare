import { useEffect, useState, useRef, type FormEvent } from "react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Tags,
  MessageSquare,
  Search,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { api } from "../services/api";
import { Confirm, Pagination } from "../components/UI";
import type { Page, Recipe } from "../types";
import { useDialogFocus } from "../hooks/useDialogFocus";
type Stats = {
  users: number;
  recipes: number;
  categories: number;
  comments: number;
  favorites: number;
  activity: { day: string; count: number }[];
  categories_data?: unknown;
};
export function Admin({
  notify,
  editRecipe,
}: {
  notify: (s: string) => void;
  editRecipe: (r: Recipe) => void;
}) {
  const [tab, setTab] = useState("overview"),
    [stats, setStats] = useState<
      | (Omit<Stats, "categories_data"> & {
          distribution: { name: string; count: number }[];
        })
      | null
    >(null),
    [rows, setRows] = useState<any[]>([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [version, setVersion] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState<{ path: string; title: string } | null>(
      null,
    ),
    [editing, setEditing] = useState<{
      id?: number;
      name: string;
      description: string;
    } | null>(null),
    [loading, setLoading] = useState(true);
  const editDialog = useRef<HTMLFormElement>(null);
  useDialogFocus(editDialog, () => setEditing(null), !!editing);
  useEffect(() => {
    api<{ data: any }>("/admin/stats")
      .then((r) => setStats(r.data))
      .catch((e) => setError(e.message));
  }, [version]);
  useEffect(() => {
    if (tab === "overview") {
      setLoading(false);
      return;
    }
    let current = true;
    setLoading(true);
    const timeout = setTimeout(() => {
      const route =
        tab === "categories" || tab === "ingredients"
          ? `/${tab}`
          : `/admin/${tab}?page=${page}&limit=10&q=${encodeURIComponent(search)}&status=${status}`;
      api<Page<any>>(route)
        .then((r) => {
          if (!current) return;
          if (tab === "categories" || tab === "ingredients") {
            const filtered = r.data.filter((x) =>
              x.name.toLowerCase().includes(search.toLowerCase()),
            );
            setTotal(filtered.length);
            setRows(filtered.slice((page - 1) * 10, page * 10));
          } else {
            setRows(r.data);
            setTotal(r.pagination.total);
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
      clearTimeout(timeout);
    };
  }, [tab, page, search, status, version]);
  function changeTab(t: string) {
    setTab(t);
    setSearch("");
    setStatus("all");
    setPage(1);
    setError("");
  }
  async function action(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      setVersion((v) => v + 1);
      notify("Đã cập nhật dữ liệu.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveCategory(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (
      await action(
        `/${tab}${editing.id ? "/" + editing.id : ""}`,
        editing.id ? "PUT" : "POST",
        { name: editing.name, description: editing.description },
      )
    )
      setEditing(null);
  }
  const tabs = [
    ["overview", "Tổng quan", LayoutDashboard],
    ["users", "Người dùng", Users],
    ["recipes", "Công thức", BookOpen],
    ["categories", "Danh mục", Tags],
    ["ingredients", "Nguyên liệu", Tags],
    ["comments", "Bình luận", MessageSquare],
  ] as const;
  return (
    <section className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <ShieldCheck size={23} />
          <b>CookShare Studio</b>
          <small>KHÔNG GIAN QUẢN TRỊ</small>
        </div>
        {tabs.map(([key, label, Icon]) => (
          <button
            className={tab === key ? "selected" : ""}
            key={key}
            onClick={() => changeTab(key)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
        <div className="admin-sidebar-foot">
          Nấu ngon. Chia sẻ tốt.
          <br />
          Quản lý bằng sự tận tâm.
        </div>
      </aside>
      <div className="admin-content">
        <div className="admin-heading">
          <div className="eyebrow">
            QUẢN TRỊ / {tabs.find((t) => t[0] === tab)?.[1].toUpperCase()}
          </div>
          <h1>{tabs.find((t) => t[0] === tab)?.[1]}</h1>
          <p>Dữ liệu và hoạt động từ cộng đồng CookShare.</p>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {tab === "overview" && stats ? (
          <>
            <div className="stat-grid">
              {[
                [Users, "Người dùng", stats.users],
                [BookOpen, "Công thức", stats.recipes],
                [Tags, "Danh mục", stats.categories],
                [MessageSquare, "Bình luận", stats.comments],
              ].map(([Icon, label, value], i) => {
                const I = Icon as typeof Users;
                return (
                  <article
                    className={"stat-card tone-" + i}
                    key={String(label)}
                  >
                    <span>
                      <I size={22} />
                    </span>
                    <div>
                      <b>{String(value)}</b>
                      <small>{String(label)}</small>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="admin-charts">
              <article className="panel">
                <h3>Công thức mới · 30 ngày qua</h3>
                <p className="muted">Số công thức được tạo theo ngày</p>
                {stats.activity.length ? (
                  <div className="activity-chart">
                    {stats.activity.map((a) => (
                      <div key={a.day}>
                        <span>{a.count}</span>
                        <i
                          style={{
                            height: `${Math.max(8, (a.count / Math.max(...stats.activity.map((x) => x.count))) * 150)}px`,
                          }}
                        />
                        <small>
                          {new Date(a.day).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Chưa có hoạt động trong 30 ngày.</p>
                )}
              </article>
              <article className="panel">
                <h3>Phân bố danh mục</h3>
                <div className="distribution">
                  {stats.distribution.map((c) => (
                    <div key={c.name}>
                      <span>
                        {c.name}
                        <b>{c.count}</b>
                      </span>
                      <i>
                        <em
                          style={{
                            width: `${(c.count / Math.max(stats.recipes, 1)) * 100}%`,
                          }}
                        />
                      </i>
                    </div>
                  ))}
                </div>
              </article>
            </div>
            <div className="panel admin-welcome">
              <ShieldCheck size={32} />
              <div>
                <h3>
                  Một cộng đồng nấu ăn tốt bắt đầu từ nội dung chất lượng.
                </h3>
                <p>
                  {stats.favorites} lượt yêu thích đã được lưu. Dùng các mục bên
                  trái để quản lý và kiểm duyệt.
                </p>
              </div>
            </div>
          </>
        ) : tab === "overview" ? (
          <div className="empty">Đang tải thống kê…</div>
        ) : (
          <>
            <div className="admin-toolbar">
              <label className="admin-search">
                <Search size={16} />
                <input
                  value={search}
                  placeholder="Tìm trong danh sách…"
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              {(tab === "users" || tab === "recipes") && (
                <select
                  aria-label="Lọc trạng thái"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Tất cả trạng thái</option>
                  {tab === "users" ? (
                    <>
                      <option value="active">Hoạt động</option>
                      <option value="disabled">Đã khóa</option>
                    </>
                  ) : (
                    <>
                      <option value="published">Đang hiển thị</option>
                      <option value="hidden">Đã ẩn</option>
                    </>
                  )}
                </select>
              )}
              {(tab === "categories" || tab === "ingredients") && (
                <button
                  className="dark-button"
                  onClick={() => setEditing({ name: "", description: "" })}
                >
                  + Thêm mới
                </button>
              )}
            </div>
            <div className="table-scroll panel">
              <table>
                <thead>
                  <tr>
                    {tab === "users" ? (
                      <>
                        <th>Người dùng</th>
                        <th>Quyền</th>
                        <th>Trạng thái</th>
                      </>
                    ) : tab === "recipes" ? (
                      <>
                        <th>Công thức</th>
                        <th>Tác giả</th>
                        <th>Trạng thái</th>
                      </>
                    ) : tab === "comments" ? (
                      <>
                        <th>Nội dung</th>
                        <th>Người viết</th>
                        <th>Công thức</th>
                      </>
                    ) : (
                      <>
                        <th>Tên</th>
                        <th>Mô tả</th>
                      </>
                    )}
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading &&
                    rows.map((row) => (
                      <tr key={row.id}>
                        {tab === "users" ? (
                          <>
                            <td>
                              <b>{row.name}</b>
                              <small>{row.email}</small>
                            </td>
                            <td>
                              <select
                                aria-label={`Quyền của ${row.name}`}
                                disabled={busy}
                                value={row.role}
                                onChange={(e) =>
                                  action(`/admin/users/${row.id}`, "PATCH", {
                                    role: e.target.value,
                                    active: !!row.active,
                                  })
                                }
                              >
                                <option value="member">USER</option>
                                <option value="admin">ADMIN</option>
                              </select>
                            </td>
                            <td>
                              <span
                                className={
                                  "badge " + (row.active ? "good" : "hidden")
                                }
                              >
                                {row.active ? "Hoạt động" : "Đã khóa"}
                              </span>
                            </td>
                            <td>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  action(`/admin/users/${row.id}`, "PATCH", {
                                    role: row.role,
                                    active: !row.active,
                                  })
                                }
                              >
                                {row.active ? "Khóa" : "Mở khóa"}
                              </button>
                            </td>
                          </>
                        ) : tab === "recipes" ? (
                          <>
                            <td>
                              <b>{row.title}</b>
                              <small>
                                #{row.id} ·{" "}
                                {row.prep_minutes + row.cook_minutes} phút
                              </small>
                            </td>
                            <td>{row.author_name}</td>
                            <td>
                              <span
                                className={
                                  "badge " +
                                  (row.status === "published"
                                    ? "good"
                                    : "hidden")
                                }
                              >
                                {row.status === "published"
                                  ? "Đang hiển thị"
                                  : "Đã ẩn"}
                              </span>
                            </td>
                            <td>
                              <div className="table-actions">
                                <button
                                  title="Chỉnh sửa"
                                  aria-label={`Sửa ${row.title}`}
                                  onClick={async () => {
                                    try {
                                      const r = await api<{ data: Recipe }>(
                                        `/recipes/${row.id}`,
                                      );
                                      editRecipe(r.data);
                                    } catch (e) {
                                      setError((e as Error).message);
                                    }
                                  }}
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  disabled={busy}
                                  title="Đổi trạng thái hiển thị"
                                  aria-label={`Kiểm duyệt ${row.title}`}
                                  onClick={() =>
                                    action(
                                      `/admin/recipes/${row.id}/status`,
                                      "PATCH",
                                      {
                                        status:
                                          row.status === "published"
                                            ? "hidden"
                                            : "published",
                                      },
                                    )
                                  }
                                >
                                  {row.status === "published" ? (
                                    <EyeOff size={16} />
                                  ) : (
                                    <Eye size={16} />
                                  )}
                                </button>
                                <button
                                  aria-label={`Xóa ${row.title}`}
                                  onClick={() =>
                                    setRemove({
                                      path: `/recipes/${row.id}`,
                                      title: "Xóa công thức này?",
                                    })
                                  }
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : tab === "comments" ? (
                          <>
                            <td className="comment-cell">{row.content}</td>
                            <td>{row.author_name}</td>
                            <td>{row.title}</td>
                            <td>
                              <button
                                aria-label="Xóa bình luận"
                                onClick={() =>
                                  setRemove({
                                    path: `/comments/${row.id}`,
                                    title: "Xóa bình luận này?",
                                  })
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>
                              <b>{row.name}</b>
                            </td>
                            <td>{row.description || "—"}</td>
                            <td>
                              <div className="table-actions">
                                <button
                                  aria-label={`Sửa ${row.name}`}
                                  onClick={() =>
                                    setEditing({
                                      id: row.id,
                                      name: row.name,
                                      description: row.description || "",
                                    })
                                  }
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  aria-label={`Xóa ${row.name}`}
                                  onClick={() =>
                                    setRemove({
                                      path: `/${tab}/${row.id}`,
                                      title: "Xóa mục này?",
                                    })
                                  }
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  {(loading || !rows.length) && (
                    <tr>
                      <td colSpan={4} className="table-empty">
                        {loading
                          ? "Đang tải dữ liệu…"
                          : "Không có kết quả phù hợp."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              total={total}
              limit={10}
              onChange={setPage}
            />
          </>
        )}
        {remove && (
          <Confirm
            title={remove.title}
            busy={busy}
            onCancel={() => setRemove(null)}
            onConfirm={async () => {
              if (await action(remove.path, "DELETE")) {
                setRemove(null);
                setPage(1);
              }
            }}
          />
        )}{" "}
        {editing && (
          <div className="modal-overlay">
            <form
              ref={editDialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="taxonomy-title"
              className="auth-modal form-panel"
              onSubmit={saveCategory}
            >
              <h2 id="taxonomy-title">
                {editing.id ? "Chỉnh sửa" : "Thêm mới"}
              </h2>
              <label>
                Tên
                <input
                  required
                  maxLength={100}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </label>
              <label>
                Mô tả
                <textarea
                  maxLength={5000}
                  value={editing.description}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                />
              </label>
              {error && <p className="auth-error">{error}</p>}
              <div className="form-actions">
                <button type="button" onClick={() => setEditing(null)}>
                  Hủy
                </button>
                <button className="dark-button" disabled={busy}>
                  Lưu
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
