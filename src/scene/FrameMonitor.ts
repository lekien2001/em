import type { FrameSample } from "../types";
export class FrameMonitor {
  samples: FrameSample[] = [];
  constructor(private capacity = 900) {}
  previous:
    | {
        mode: string;
        at: number;
      }
    | undefined;
  record(A: string, i: number, I: number, E: number, e: number) {
    if (A === "idle") {
      this.previous = void 0;
      return;
    }
    if (this.previous?.mode === A) {
      let g = i - this.previous.at;
      g > 0 &&
        (this.samples.push({
          mode: A,
          at: i,
          intervalMs: g,
          submitMs: I,
          drawCalls: E,
          triangles: e,
        }),
        this.samples.length > this.capacity && this.samples.shift());
    }
    this.previous = {
      mode: A,
      at: i,
    };
  }
  suspend() {
    this.previous = void 0;
  }
  reset() {
    this.samples.length = 0;
    this.suspend();
  }
}
