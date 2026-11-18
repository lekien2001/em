import type { FrameSample } from "../types";

export type RenderMode = "baseline" | "scale90" | "shadow30" | "both";

export function renderExperiment(search: string) {
  const query = new URLSearchParams(search);
  const enabled = query.get("qa") === "1";
  const requested = enabled ? query.get("render") : null;
  const mode: RenderMode = requested === "scale90" || requested === "shadow30" || requested === "both"
    ? requested : "baseline";
  return {
    enabled,
    mode,
    scale: mode === "scale90" || mode === "both" ? 0.9 : 1,
    shadowInterval: mode === "shadow30" || mode === "both" ? 1000 / 30 : 0,
  };
}

export function measureFrameIntervals(samples: readonly FrameSample[]) {
  const intervals = samples.map(sample => sample.intervalMs).sort((a, b) => a - b);
  if (!intervals.length) return null;
  const duration = intervals.reduce((total, value) => total + value, 0);
  return {
    frames: intervals.length,
    fps: 1000 * intervals.length / duration,
    p95Ms: intervals[Math.ceil(0.95 * intervals.length) - 1],
    over25MsPercent: 100 * intervals.filter(interval => interval > 25).length / intervals.length,
  };
}

/** Run while playing, with the original camera and the page in the foreground. */
export async function benchmarkRender(
  samples: readonly FrameSample[],
  mode: RenderMode,
  isStable: () => boolean,
) {
  if (!isStable()) throw new Error("Bật phát và giữ trang ở phía trước trước khi đo.");
  let interrupted = false;
  const invalidate = () => { interrupted = true; };
  document.addEventListener("visibilitychange", invalidate);
  window.addEventListener("resize", invalidate);
  const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));
  try {
    await wait(5000);
    if (interrupted || !isStable()) throw new Error("Phiên đo bị gián đoạn. Hãy đo lại.");
    const start = performance.now();
    await wait(20000);
    const end = performance.now();
    const selected = samples.filter(sample => sample.at - sample.intervalMs >= start && sample.at <= end);
    if (interrupted || !isStable() || selected.some(sample => sample.mode !== "playing")) {
      throw new Error("Giữ nguyên kích thước và góc nhìn trong khi đo.");
    }
    const metrics = measureFrameIntervals(selected);
    const covered = selected.reduce((total, sample) => total + sample.intervalMs, 0);
    if (!metrics || covered < (end - start) * 0.9) throw new Error("Chưa đủ khung hình liên tục để đo.");
    return { mode, ...metrics };
  } finally {
    document.removeEventListener("visibilitychange", invalidate);
    window.removeEventListener("resize", invalidate);
  }
}
