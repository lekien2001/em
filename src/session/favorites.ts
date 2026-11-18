import { restoreMix, validFavoriteConfig, type FavoriteConfig } from "./config";
export type Favorite = {
  id: string;
  name: string;
  config: FavoriteConfig;
};
export const FAVORITES_KEY = "em:favorites-v1";
export function validateName(raw: string, entries: Favorite[], except?: string) {
  const name = raw.trim();
  if (!name || name.length > 40) return "Đặt tên từ 1 đến 40 ký tự.";
  if (entries.some(e => e.id !== except && e.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"))) return "Tên này đã có. Hãy chọn tên khác.";
  return "";
}
export function readFavorites(): {
  entries: Favorite[];
  warning: string;
} {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return {
      entries: [],
      warning: ""
    };
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Array.isArray(data.entries) || data.entries.length > 10) throw new Error("Invalid favorites");
    const entries: Favorite[] = [];
    for (const entry of data.entries) {
      const mix = restoreMix(entry?.config?.mix);
      const config = { ...entry?.config, mix };
      if (typeof entry?.id !== "string" || !entry.id || entries.some(saved => saved.id === entry.id) ||
          typeof entry.name !== "string" || entry.name !== entry.name.trim() || validateName(entry.name, entries) ||
          !validFavoriteConfig(config)) throw new Error("Invalid favorites");
      entries.push({ id: entry.id, name: entry.name, config });
    }
    return {
      entries,
      warning: ""
    };
  } catch {
    return {
      entries: [],
      warning: "Không đọc được phiên đã lưu. Bạn vẫn có thể dùng và lưu phiên trong lần mở này."
    };
  }
}
export function writeFavorites(entries: Favorite[]) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify({
      version: 1,
      entries
    }));
    return "";
  } catch {
    return "Trình duyệt không cho lưu trên thiết bị. Thay đổi chỉ được giữ trong lần mở này.";
  }
}
