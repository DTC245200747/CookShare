import { useEffect, useState, type FormEvent } from "react";
import { Star, MessageCircle, Trash2, Pencil, Check, X } from "lucide-react";
import { api } from "../services/api";
import type { User, Page } from "../types";
import { Pagination, Confirm } from "./UI";
type Comment = {
  id: number;
  user_id: number;
  author_name: string;
  content: string;
  created_at: string;
};
export function Community({
  recipeId,
  user,
  login,
  notify,
  changed,
}: {
  recipeId: number;
  user: User | null;
  login: () => void;
  notify: (s: string) => void;
  changed: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [rating, setRating] = useState(0),
    [text, setText] = useState(""),
    [edit, setEdit] = useState<number | null>(null),
    [editText, setEditText] = useState(""),
    [remove, setRemove] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    api<Page<Comment>>(`/recipes/${recipeId}/comments?page=${page}&limit=5`)
      .then((r) => {
        if (current) {
          setComments(r.data);
          setTotal(r.pagination.total);
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [recipeId, page, version]);
  useEffect(() => {
    setRating(0);
    if (user)
      api<{ data: { rating: number } }>(`/recipes/${recipeId}/interactions`)
        .then((r) => setRating(r.data.rating))
        .catch((e) => setError(e.message));
  }, [recipeId, user]);
  async function rate(score: number) {
    if (!user) {
      login();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/recipes/${recipeId}/rating`, {
        method: "PUT",
        body: JSON.stringify({ score }),
      });
      setRating(score);
      changed();
      notify("Đã lưu đánh giá của bạn.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function comment(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      login();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/recipes/${recipeId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: text }),
      });
      setText("");
      setPage(1);
      setVersion((v) => v + 1);
      notify("Đã đăng bình luận.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="community-section">
      <div className="eyebrow">CHIA SẺ TRẢI NGHIỆM CỦA BẠN</div>
      <h2>
        Góc <em>trò chuyện</em>
      </h2>
      <div className="rating-control">
        <span>Bạn thấy món này thế nào?</span>
        <div>
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              aria-label={`Đánh giá ${s} sao`}
              disabled={busy}
              onClick={() => rate(s)}
            >
              <Star
                size={24}
                color="#d5a046"
                fill={s <= rating ? "#edaf35" : "none"}
              />
            </button>
          ))}
        </div>
        {rating > 0 && <small>Đánh giá của bạn: {rating}/5</small>}
      </div>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={comment} className="comment-form">
        <textarea
          aria-label="Bình luận của bạn"
          placeholder={
            user
              ? "Mẹo hay, cảm nhận hay một lời nhắn từ căn bếp của bạn…"
              : "Đăng nhập để chia sẻ cảm nhận…"
          }
          rows={3}
          required={!!user}
          disabled={!user}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type={user?'submit':'button'} onClick={user?undefined:login} className="dark-button" disabled={busy}>
          <MessageCircle size={15} />
          {user ? "Gửi bình luận" : "Đăng nhập để bình luận"}
        </button>
      </form>
      <h3 className="comment-count">{total} bình luận</h3>
      {comments.map((c) => (
        <article className="comment" key={c.id}>
          <div className="comment-head">
            <b>{c.author_name}</b>
            <time>{new Date(c.created_at).toLocaleDateString("vi-VN")}</time>
          </div>
          {edit === c.id ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await api(`/comments/${c.id}`, {
                    method: "PUT",
                    body: JSON.stringify({ content: editText }),
                  });
                  setEdit(null);
                  setVersion((v) => v + 1);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <textarea
                aria-label="Sửa bình luận"
                required
                maxLength={2000}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
              />
              <button disabled={busy} aria-label="Lưu bình luận">
                <Check size={17} />
              </button>
              <button
                type="button"
                aria-label="Hủy"
                onClick={() => setEdit(null)}
              >
                <X size={17} />
              </button>
            </form>
          ) : (
            <p>{c.content}</p>
          )}
          <div className="comment-actions">
            {user?.id === c.user_id && (
              <button
                onClick={() => {
                  setEdit(c.id);
                  setEditText(c.content);
                }}
              >
                <Pencil size={13} />
                Sửa
              </button>
            )}
            {(user?.id === c.user_id || user?.role === "admin") && (
              <button onClick={() => setRemove(c.id)}>
                <Trash2 size={13} />
                Xóa
              </button>
            )}
          </div>
        </article>
      ))}
      {!comments.length && (
        <p className="muted">Hãy là người đầu tiên chia sẻ cảm nhận.</p>
      )}
      <Pagination page={page} total={total} limit={5} onChange={setPage} />
      {remove && (
        <Confirm
          title="Xóa bình luận này?"
          busy={busy}
          onCancel={() => setRemove(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await api(`/comments/${remove}`, { method: "DELETE" });
              setRemove(null);
              setVersion((v) => v + 1);
              notify("Đã xóa bình luận.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </section>
  );
}
