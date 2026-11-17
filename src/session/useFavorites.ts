import { useRef, useState } from "react";
import { readFavorites, validateName, writeFavorites, type Favorite } from "./favorites";
import { validFavoriteConfig, type FavoriteConfig } from "./config";
export function useFavorites() {
  const [state, setState] = useState(readFavorites),
    latest = useRef(state.entries);
  latest.current = state.entries;
  function commit(entries: Favorite[]) {
    latest.current = entries;
    setState({
      entries,
      warning: writeFavorites(entries)
    });
  }
  function save(name: string, config: FavoriteConfig) {
    if (latest.current.length >= 10) return "Đã đủ 10 phiên. Hãy cập nhật hoặc xóa một phiên.";
    const error = validateName(name, latest.current);
    if (error) return error;
    if (!validFavoriteConfig(config)) return "Cấu hình không hợp lệ.";
    commit([...latest.current, {
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, "0")).join(""),
      name: name.trim(),
      config: structuredClone(config)
    }]);
    return "";
  }
  function rename(id: string, name: string) {
    const error = validateName(name, latest.current, id);
    if (error) return error;
    commit(latest.current.map(e => e.id === id ? {
      ...e,
      name: name.trim()
    } : e));
    return "";
  }
  function update(id: string, config: FavoriteConfig) {
    if (validFavoriteConfig(config)) commit(latest.current.map(e => e.id === id ? {
      ...e,
      config: structuredClone(config)
    } : e));
  }
  function remove(id: string) {
    commit(latest.current.filter(e => e.id !== id));
  }
  return {
    ...state,
    save,
    rename,
    update,
    remove
  };
}
