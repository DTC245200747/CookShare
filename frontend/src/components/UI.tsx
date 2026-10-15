import { X, ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";
export function Pagination({
  page,
  total,
  limit,
  onChange,
}: {
  page: number;
  total: number;
  limit: number;
  onChange: (n: number) => void;
}) {
  const pages = Math.ceil(total / limit);
  return pages > 1 ? (
    <div className="pagination">
      <button
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label="Trang trước"
      >
        <ArrowLeft size={16} />
      </button>
      <span>
        Trang {page} / {pages} · {total} kết quả
      </span>
      <button
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        aria-label="Trang sau"
      >
        <ArrowRight size={16} />
      </button>
    </div>
  ) : null;
}
export function Confirm({
  title,
  onCancel,
  onConfirm,
  busy,
}: {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <div className="modal-overlay">
      <section
        className="auth-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <AlertCircle color="#bd7331" size={32} />
        <h2>{title}</h2>
        <p>Thao tác này sẽ xóa dữ liệu và không thể hoàn tác.</p>
        <div className="form-actions">
          <button onClick={onCancel} disabled={busy}>
            Hủy
          </button>
          <button className="danger-button" disabled={busy} onClick={onConfirm}>
            {busy ? "Đang xóa…" : "Xác nhận xóa"}
          </button>
        </div>
      </section>
    </div>
  );
}
export function Skeleton() {
  return (
    <div className="recipe-grid" aria-label="Đang tải">
      {Array.from({ length: 6 }, (_, i) => (
        <div className="skeleton-card" key={i}>
          <div />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
export function Toast({
  message,
  close,
}: {
  message: string;
  close: () => void;
}) {
  return (
    <div className="toast" role="status">
      {message}
      <button onClick={close} aria-label="Đóng thông báo">
        <X size={16} />
      </button>
    </div>
  );
}
