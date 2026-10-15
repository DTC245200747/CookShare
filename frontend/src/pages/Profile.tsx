import { useState, type FormEvent } from "react";
import { Camera, ChefHat, LogOut } from "lucide-react";
import { api, uploadImage } from "../services/api";
import type { User } from "../types";
import { ProfileCollections } from "../components/ProfileCollections";
export function Profile({
  user,
  updated,
  logout,
  notify,
}: {
  user: User;
  updated: (u: User) => void;
  logout: () => void;
  notify: (s: string) => void;
}) {
  const [name, setName] = useState(user.name),
    [bio, setBio] = useState(user.bio || ""),
    [avatar, setAvatar] = useState(user.avatar_url || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ data: User }>("/auth/me", {
        method: "PUT",
        body: JSON.stringify({ name, bio, avatar_url: avatar || null }),
      });
      updated(r.data);
      notify("Đã lưu hồ sơ của bạn.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function password(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) {
      setError("Mật khẩu xác nhận chưa khớp.");
      setBusy(false);
      return;
    }
    try {
      await api("/auth/password", {
        method: "PUT",
        body: JSON.stringify({
          current_password: f.get("current"),
          password: f.get("password"),
        }),
      });
      notify("Đổi mật khẩu thành công. Vui lòng đăng nhập lại.");
      sessionStorage.removeItem("cookshare-token");
      logout();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-section">
      <div className="eyebrow">CĂN BẾP CỦA RIÊNG BẠN</div>
      <h1>
        Hồ sơ <em>cá nhân.</em>
      </h1>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="profile-grid">
        <form className="panel form-panel" onSubmit={save}>
          <div className="profile-head">
            <div className="profile-avatar">
              {avatar ? (
                <img src={avatar} alt="Ảnh đại diện" />
              ) : (
                <ChefHat size={38} />
              )}
            </div>
            <label className="avatar-upload">
              <Camera size={17} /> Đổi ảnh đại diện
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBusy(true);
                  try {
                    setAvatar(await uploadImage(f));
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
          </div>
          <label>
            Tên hiển thị
            <input
              required
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Email
            <input value={user.email} disabled />
          </label>
          <label>
            Đôi lời về bạn
            <textarea
              rows={4}
              value={bio}
              maxLength={1000}
              onChange={(e) => setBio(e.target.value)}
            />
          </label>
          <button className="dark-button" disabled={busy}>
            Lưu hồ sơ
          </button>
        </form>
        <div>
          <form className="panel form-panel" onSubmit={password}>
            <h3>Đổi mật khẩu</h3>
            <label>
              Mật khẩu hiện tại
              <input
                type="password"
                name="current"
                autoComplete="current-password"
                required
                maxLength={72}
              />
            </label>
            <label>
              Mật khẩu mới
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={72}
              />
            </label>
            <label>
              Xác nhận mật khẩu mới
              <input
                type="password"
                name="confirm"
                autoComplete="new-password"
                required
                minLength={10}
                maxLength={72}
              />
            </label>
            <button className="dark-button" disabled={busy}>
              Cập nhật mật khẩu
            </button>
          </form>
          <button
            className="logout-button"
            onClick={async () => {
              try {
                await api("/auth/logout", { method: "POST" });
              } catch (e) {
                notify((e as Error).message);
                return;
              }
              sessionStorage.removeItem("cookshare-token");
              logout();
            }}
          >
            <LogOut size={17} />
            Đăng xuất khỏi mọi thiết bị
          </button>
        </div>
      </div>
      <ProfileCollections />
    </section>
  );
}
