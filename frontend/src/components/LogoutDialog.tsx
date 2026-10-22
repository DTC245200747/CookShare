import { useEffect, useRef, useState } from "react";
import { LogOut, X, Monitor, Shield } from "lucide-react";
import { api } from "../services/api";
import { useDialogFocus } from "../hooks/useDialogFocus";

export function LogoutDialog({
  close,
  done,
}: {
  close: () => void;
  done: () => void;
}) {
  const [scope, setScope] = useState<"device" | "all" | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef<HTMLElement>(null),
    cancel = useRef<HTMLButtonElement>(null);
  useDialogFocus(dialog, () => {
    if (!busy) close();
  });
  useEffect(() => {
    if (scope) cancel.current?.focus();
  }, [scope]);
  async function confirm() {
    if (!scope || busy) return;
    setBusy(true);
    setError("");
    try {
      if (scope === "all") await api("/auth/logout", { method: "POST" });
      sessionStorage.removeItem("cookshare-token");
      done();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="modal-overlay">
      <section
        ref={dialog}
        className="auth-modal logout-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        aria-describedby="logout-description"
        aria-busy={busy}
      >
        <button
          className="close-modal"
          aria-label="Đóng"
          disabled={busy}
          onClick={close}
        >
          <X size={20} />
        </button>
        <LogOut className="auth-icon" size={32} />
        <h2 id="logout-title">{scope ? "Xác nhận đăng xuất?" : "Đăng xuất"}</h2>
        <p id="logout-description">
          {scope
            ? `Bạn có chắc muốn đăng xuất ${scope === "all" ? "khỏi mọi thiết bị" : "khỏi thiết bị này"} không?`
            : "Chọn nơi bạn muốn đăng xuất tài khoản."}
        </p>
        {!scope ? (
          <div className="logout-options">
            <button onClick={() => setScope("device")}>
              <Monitor size={22} />
              <span>
                <b>Đăng xuất khỏi thiết bị này</b>
                <small>Các phiên trên thiết bị khác được giữ lại.</small>
              </span>
            </button>
            <button onClick={() => setScope("all")}>
              <Shield size={22} />
              <span>
                <b>Đăng xuất khỏi mọi thiết bị</b>
                <small>Yêu cầu đăng nhập lại trên tất cả thiết bị.</small>
              </span>
            </button>
          </div>
        ) : (
          <>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                ref={cancel}
                className="text-link"
                disabled={busy}
                onClick={close}
              >
                Hủy
              </button>
              <button className="dark-button" disabled={busy} onClick={confirm}>
                {busy ? "Đang đăng xuất…" : "Xác nhận đăng xuất"}
              </button>
            </div>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => {
                setScope(null);
                setError("");
              }}
            >
              Chọn lại thiết bị
            </button>
          </>
        )}
      </section>
    </div>
  );
}
