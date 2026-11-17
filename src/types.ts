export type SoundId = "rain" | "stream" | "brown";
export type SheepSpeed = "slow" | "medium";
export type Quality = "low" | "balanced" | "high";
export type DurationMinutes = 0 | 15 | 30 | 60;
export type SceneProps = {
  playing: boolean;
  reduced: boolean;
  speed: SheepSpeed;
  reset: number;
  sessionId: number;
  onCount(): void;
  onReady(ready: boolean): void;
};
export type ImmersionState = {
  playing: boolean;
  sleep: boolean;
  blocked: boolean;
  wake(): void;
};
export type FrameSample = {
  mode: string;
  at: number;
  intervalMs: number;
  submitMs: number;
  drawCalls: number;
  triangles: number;
};
