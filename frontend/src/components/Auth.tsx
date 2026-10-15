import { useRef, useState, type FormEvent } from "react";
import { ChefHat, X, ArrowRight } from "lucide-react";
import { api } from "../services/api";
import type { User } from "../types";
import { useDialogFocus } from "../hooks/useDialogFocus";
export function Auth({
  close,
  success,
}: {
  close: () => void;
  success: (user: User) => void;
}) {
  const [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  useDialogFocus(dialog, close);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget),
      email = String(f.get("email")),
      password = String(f.get("password"));
    try {
      if (register)
        await api("/auth/register", {
          method: "POST",
          body: JSON.stringify({ name: f.get("name"), email, password }),
        });
      const r = await api<{ data: { user: User; access_token: string } }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) },
      );
      sessionStorage.setItem("cookshare-token", r.data.access_token);
      success(r.data.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-overlay" onClick={close}>
      <section
        ref={dialog}
        className="auth-modal auth-experience"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="auth-visual" aria-hidden="true">
          <img src="/images/salad.jpg" alt="" />
          <div>
            <span>COOKSHARE JOURNAL</span>
            <h3>
              Một căn bếp.
              <br />
              Ngàn cảm hứng.
            </h3>
            <p>Gửi chút yêu thương vào mỗi món ăn.</p>
          </div>
        </div>
        <div className="auth-content">
          <button className="close-modal" onClick={close} aria-label="Đóng">
            <X size={20} />
          </button>
          <ChefHat className="auth-icon" size={32} />
          <h2 id="auth-title">
            {register ? "Ghé bếp cùng nhau." : "Mừng bạn trở lại."}
          </h2>
          <p>
            {register
              ? "Bắt đầu hành trình nấu nướng của riêng bạn."
              : "Đăng nhập và lưu giữ những hương vị yêu thích."}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Tên của bạn
                <input
                  name="name"
                  autoComplete="name"
                  maxLength={100}
                  required
                />
              </label>
            )}
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Mật khẩu
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                minLength={10}
                maxLength={72}
                placeholder="Ít nhất 10 ký tự"
                required
              />
            </label>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button className="dark-button" disabled={busy}>
              {busy ? "Đang xử lý…" : register ? "Tạo tài khoản" : "Đăng nhập"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="switch-auth">
            {register ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
            <button
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register ? "Đăng nhập" : "Đăng ký ngay"}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}
