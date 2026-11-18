import { useLayoutEffect, useRef, useState } from "react";
import { sounds } from "../audio/catalog";
import type { FavoriteConfig } from "../session/config";
import type { Favorite } from "../session/favorites";
import type { useFavorites } from "../session/useFavorites";
import { ChevronDown } from "./icons";

type CardAction = "apply" | "rename" | "delete" | "cancel-delete";
type FocusTarget = { id: string; action: CardAction } | { id: null };

export function FavoritesPanel({ favorites, current, apply, back }: {
  favorites: ReturnType<typeof useFavorites>;
  current(): FavoriteConfig;
  apply(favorite: Favorite): void;
  back(): void;
}) {
  const [name, setName] = useState(""), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [editing, setEditing] = useState<string | null>(null), [draft, setDraft] = useState(""), [deleting, setDeleting] = useState<string | null>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const nameInput = useRef<HTMLInputElement>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);
  // Editing/confirmation replace their trigger. Restore focus after DOM commit,
  // without a frame delay or a selector built from a user-controlled name/id.
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const element = target.id === null ? nameInput.current : cards.current.get(target.id)?.querySelector<HTMLElement>(`[data-favorite-action="${target.action}"]`);
    element?.focus({ preventScroll: true });
  });

  return <div className="favorites-panel">
    <button className="panel-back" aria-label="Quay lại Tùy chọn" onClick={back}><ChevronDown size={16} className="back-chevron" /><span>Tùy chọn</span></button>
    <p className="popover-note">Áp dụng sẽ tạm dừng, đưa cừu và đồng hồ về đầu phiên. Góc nhìn và ảnh mặt được giữ nguyên.</p>
    <form noValidate onSubmit={event => {
      event.preventDefault();
      const result = favorites.save(name, current());
      setError(result);
      if (!result) { setName(""); setMessage("Đã thêm phiên yêu thích."); }
    }}>
      <label htmlFor="favorite-name">Lưu cấu hình hiện tại</label>
      <div className="inline-fields">
        <input ref={nameInput} id="favorite-name" maxLength={40} value={name} placeholder="Tên phiên yêu thích" onChange={event => setName(event.target.value)} />
        <button disabled={favorites.entries.length >= 10} type="submit">Lưu</button>
      </div>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {favorites.warning && <p className="storage-warning" role="status">{favorites.warning}</p>}
    {message && !favorites.warning && <p className="popover-note" role="status">{message}</p>}
    {!favorites.entries.length && <p className="favorite-empty">Chưa có phiên yêu thích. Lưu âm thanh và các lựa chọn bạn thường dùng tại đây.</p>}
    <div className="favorite-list">{favorites.entries.map((entry, index) => <article
      className="favorite-card" key={entry.id} aria-label={entry.name}
      ref={element => { if (element) cards.current.set(entry.id, element); else cards.current.delete(entry.id); }}
    >
      {editing === entry.id ? <form className="favorite-rename" noValidate onSubmit={event => {
        event.preventDefault();
        const result = favorites.rename(entry.id, draft);
        setError(result);
        if (!result) {
          pendingFocus.current = { id: entry.id, action: "rename" };
          setEditing(null); setMessage("Đã đổi tên phiên.");
        }
      }}>
        <label htmlFor="rename-favorite">Đổi tên phiên</label>
        <div className="inline-fields">
          <input autoFocus id="rename-favorite" maxLength={40} value={draft} onChange={event => setDraft(event.target.value)} />
          <button type="submit">Lưu tên</button>
          <button type="button" onClick={() => {
            pendingFocus.current = { id: entry.id, action: "rename" };
            setEditing(null); setError("");
          }}>Hủy</button>
        </div>
      </form> : <>
        <h3>{entry.name}</h3>
        <p>{sounds.filter(sound => entry.config.mix[sound.id].enabled).map(sound => sound.label).join(" + ")} · {entry.config.duration ? `${entry.config.duration} phút` : "Không giới hạn"} · {Math.round(entry.config.volume * 100)}%</p>
      </>}
      {editing !== entry.id && deleting !== entry.id && <div className="favorite-actions">
        <button data-favorite-action="apply" onClick={() => apply(entry)}>Áp dụng</button>
        <button onClick={() => { favorites.update(entry.id, current()); setMessage("Đã cập nhật bằng cấu hình hiện tại."); }}>Cập nhật</button>
        <button data-favorite-action="rename" onClick={() => { setEditing(entry.id); setDraft(entry.name); setError(""); setDeleting(null); }}>Đổi tên</button>
        <button data-favorite-action="delete" onClick={() => {
          pendingFocus.current = { id: entry.id, action: "cancel-delete" };
          setDeleting(entry.id); setEditing(null);
        }}>Xóa</button>
      </div>}
      {deleting === entry.id && <div className="delete-confirm">
        <span>Xóa phiên này?</span>
        <button onClick={() => {
          const next = favorites.entries[index + 1] ?? favorites.entries[index - 1];
          pendingFocus.current = next ? { id: next.id, action: "apply" } : { id: null };
          favorites.remove(entry.id); setDeleting(null); setMessage("Đã xóa phiên.");
        }}>Xác nhận xóa</button>
        <button data-favorite-action="cancel-delete" onClick={() => {
          pendingFocus.current = { id: entry.id, action: "delete" };
          setDeleting(null);
        }}>Hủy</button>
      </div>}
    </article>)}</div>
    <p className="popover-note">{favorites.entries.length}/10 phiên · Chỉ lưu trên trình duyệt này, không lưu ảnh cá nhân.</p>
  </div>;
}
