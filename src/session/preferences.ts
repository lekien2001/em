/** Storage may be blocked, including an offline HTML opened locally. */
export function readPreference(key: string, fallback: string) {
  try {
    return localStorage.getItem(`em:${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}
export function writePreference(key: string, value: string) {
  try {
    localStorage.setItem(`em:${key}`, value);
  } catch {
    /* Session remains usable. */
  }
}
