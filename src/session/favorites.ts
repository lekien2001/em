import { validFavoriteConfig, type FavoriteConfig } from "./config";
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
    if (data?.version !== 1 || !Array.isArray(data.entries) || data.entries.length > 10 || !data.entries.every((e: Favorite, i: number, all: Favorite[]) => e && typeof e.id === "string" && e.id && !all.slice(0, i).some(x => x.id === e.id) && typeof e.name === "string" && !validateName(e.name, all.slice(0, i)) && e.name === e.name.trim() && validFavoriteConfig(e.config))) throw new Error("Invalid favorites");
    return {
      entries: data.entries,
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
