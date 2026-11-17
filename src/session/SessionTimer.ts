import type { FadeSeconds } from "../types";
import { validDuration, validFade } from "./config";
const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** Deadline and shared visual/audio envelope. Resume shifts a frozen recovery. */
export class SessionTimer {
  duration = 30;
  fadeSeconds: FadeSeconds = 15;
  running = false;
  started = false;
  ended = false;
  private held: number | null = 1800000;
  private deadline: number | null = null;
  private frozenAt: number;
  private recovery?: {
    from: number;
    to: number;
    start: number;
    end: number;
  };
  constructor(private now: () => number = Date.now) {
    this.frozenAt = now();
  }
  get remaining() {
    return this.running && this.deadline !== null ? Math.max(0, this.deadline - this.now()) : this.held;
  }
  get windowMs() {
    return this.duration === 0 ? 0 : Math.min(this.fadeSeconds * 1000, this.duration * 60000);
  }
  private canonical(at: number) {
    const left = this.running && this.deadline !== null ? this.deadline - at : this.held;
    return left === null || !this.windowMs ? 1 : clamp(left / this.windowMs);
  }
  get fade() {
    const at = this.running ? this.now() : this.frozenAt,
      r = this.recovery;
    if (!r || at >= r.end) return this.canonical(at);
    const t = clamp((at - r.start) / (r.end - r.start));
    return r.from + (r.to - r.from) * t;
  }
  get recoveryMs() {
    return this.running && this.recovery ? Math.max(0, this.recovery.end - this.now()) : 0;
  }
  private recover(from: number) {
    const at = this.now(),
      left = this.remaining;
    this.recovery = this.running && (left === null || left > 0) ? {
      from,
      to: this.canonical(at + Math.min(1500, left ?? 1500)),
      start: at,
      end: at + Math.min(1500, left ?? 1500)
    } : undefined;
  }
  start() {
    const at = this.now();
    if (this.ended) {
      this.held = this.duration ? this.duration * 60000 : null;
      this.ended = false;
      this.recovery = undefined;
    }
    if (this.recovery) {
      const shift = at - this.frozenAt;
      this.recovery.start += shift;
      this.recovery.end += shift;
    }
    this.deadline = this.held === null ? null : at + this.held;
    this.running = this.started = true;
  }
  pause() {
    if (this.running) {
      this.held = this.remaining;
      this.frozenAt = this.now();
      this.running = false;
      this.deadline = null;
    }
  }
  configure(minutes: number) {
    if (!validDuration(minutes)) throw new Error("Nhập số phút nguyên từ 1 đến 720.");
    const before = this.fade;
    if (this.ended) this.started = false;
    this.duration = minutes;
    this.held = minutes ? minutes * 60000 : null;
    this.ended = false;
    this.deadline = this.running && this.held !== null ? this.now() + this.held : null;
    this.recover(before);
  }
  setFade(seconds: FadeSeconds) {
    if (validFade(seconds)) {
      const before = this.fade;
      this.fadeSeconds = seconds;
      this.recover(before);
    }
  }
  canExtend(minutes: number) {
    return this.started && !this.ended && this.duration > 0 && this.duration + minutes <= 720 && (this.remaining ?? 0) > 0;
  }
  extend(minutes: 5 | 10) {
    if (!this.canExtend(minutes)) return false;
    const before = this.fade;
    this.held = (this.remaining ?? 0) + minutes * 60000;
    this.duration += minutes;
    if (this.deadline !== null) this.deadline += minutes * 60000;
    this.recover(before);
    return true;
  }
  apply(minutes: number, fade: FadeSeconds) {
    this.pause();
    this.configure(minutes);
    this.fadeSeconds = fade;
    this.started = this.ended = false;
    this.recovery = undefined;
  }
  check() {
    if (!this.running || this.remaining !== 0) return false;
    this.held = 0;
    this.deadline = null;
    this.running = false;
    this.ended = true;
    this.recovery = undefined;
    return true;
  }
}
