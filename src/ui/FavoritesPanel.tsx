import { useState } from "react";
import { sounds } from "../audio/catalog";
import type { FavoriteConfig } from "../session/config";
import type { Favorite } from "../session/favorites";
import type { useFavorites } from "../session/useFavorites";
export function FavoritesPanel({
  favorites,
  current,
  apply,
  back
}: {
  favorites: ReturnType<typeof useFavorites>;
  current(): FavoriteConfig;
  apply(favorite: Favorite): void;
  back(): void;
}) {
  const [name, setName] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [editing, setEditing] = useState<string | null>(null),
    [draft, setDraft] = useState(""),
    [deleting, setDeleting] = useState<string | null>(null);
  return <div className="favorites-panel">
    <button className="panel-back" onClick={back}>‹ Tùy chọn</button>
    <p className="popover-note">Áp dụng sẽ tạm dừng, đưa cừu và đồng hồ về đầu phiên. Góc nhìn và ảnh mặt được giữ nguyên.</p>
    <form noValidate onSubmit={e => {
      e.preventDefault();
      const result = favorites.save(name, current());
      setError(result);
      if (!result) {
        setName("");
        setMessage("Đã thêm phiên yêu thích.");
      }
    }}>
      <label htmlFor="favorite-name">Lưu cấu hình hiện tại</label><div className="inline-fields"><input id="favorite-name" maxLength={40} value={name} placeholder="Tên phiên yêu thích" onChange={e => setName(e.target.value)} /><button disabled={favorites.entries.length >= 10} type="submit">Lưu</button></div>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {favorites.warning && <p className="storage-warning" role="status">{favorites.warning}</p>}
    {message && !favorites.warning && <p className="popover-note" role="status">{message}</p>}
    {!favorites.entries.length && <p className="favorite-empty">Chưa có phiên yêu thích. Lưu âm thanh và các lựa chọn bạn thường dùng tại đây.</p>}
    <div className="favorite-list">{favorites.entries.map(entry => <article className="favorite-card" key={entry.id} aria-label={entry.name}>
      {editing === entry.id ? <form noValidate onSubmit={e => {
          e.preventDefault();
          const result = favorites.rename(entry.id, draft);
          setError(result);
          if (!result) {
            setEditing(null);
            setMessage("Đã đổi tên phiên.");
          }
        }}><label htmlFor="rename-favorite">Đổi tên phiên</label><div className="inline-fields"><input autoFocus id="rename-favorite" maxLength={40} value={draft} onChange={e => setDraft(e.target.value)} /><button type="submit">Lưu tên</button><button type="button" onClick={() => {
              setEditing(null);
              setError("");
            }}>Hủy</button></div></form> : <><h3>{entry.name}</h3><p>{sounds.filter(s => entry.config.mix[s.id].enabled).map(s => s.label).join(" + ")} · {entry.config.duration ? `${entry.config.duration} phút` : "Không giới hạn"} · {Math.round(entry.config.volume * 100)}%</p></>}
      <div className="favorite-actions"><button onClick={() => apply(entry)}>Áp dụng</button><button onClick={() => {
            favorites.update(entry.id, current());
            setMessage("Đã cập nhật bằng cấu hình hiện tại.");
          }}>Cập nhật</button><button onClick={() => {
            setEditing(entry.id);
            setDraft(entry.name);
            setError("");
            setDeleting(null);
          }}>Đổi tên</button><button onClick={() => {
            setDeleting(entry.id);
            setEditing(null);
          }}>Xóa</button></div>
      {deleting === entry.id && <div className="delete-confirm"><span>Xóa phiên này?</span><button onClick={() => {
            favorites.remove(entry.id);
            setDeleting(null);
            setMessage("Đã xóa phiên.");
          }}>Xác nhận xóa</button><button onClick={() => setDeleting(null)}>Hủy</button></div>}
    </article>)}</div><p className="popover-note">{favorites.entries.length}/10 phiên · Chỉ lưu trên trình duyệt này, không lưu ảnh cá nhân.</p>
  </div>;
}
