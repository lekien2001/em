export type SoundId = "rain" | "stream" | "brown";
export type SheepSpeed = "slow" | "medium";
export type Quality = "low" | "balanced" | "high";
/** Integer 1–720, or 0 for unlimited. Validate at configuration boundaries. */
export type DurationMinutes = number;
export type FadeSeconds = 15 | 60 | 180;
export type FaceAppearance = { readonly canvas: HTMLCanvasElement; readonly revision: number };
export type SceneProps = {
  playing: boolean;
  reduced: boolean;
  speed: SheepSpeed;
  reset: number;
  sessionId: number;
  onCount(): void;
  onReady(ready: boolean): void;
  face?: FaceAppearance | null;
  onFaceError?(message: string): void;
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
