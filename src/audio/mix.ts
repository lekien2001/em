import { SOUND_IDS, type MixConfig } from "../session/config";
export type Levels = number[];
export function normalizeLevels(levels: number[]): Levels {
  const peakSum = levels.reduce((sum, level) => sum + Math.abs(level), 0);
  const divisor = Math.max(1, Math.hypot(...levels), peakSum / Math.sqrt(3));
  return levels.map(level => level / divisor);
}
export const mixLevels = (mix: MixConfig): Levels => normalizeLevels(SOUND_IDS.map(id => mix[id].enabled ? mix[id].level : 0));
export type MixCurve = {
  from: Levels;
  to: Levels;
  at: number;
  duration: number;
  equalPower: boolean;
};
export function sampleMix(curve: MixCurve, at: number): Levels {
  const t = Math.max(0, Math.min(1, (at - curve.at) / curve.duration));
  if (t === 1) return curve.to;
  const a = curve.equalPower ? Math.cos(t * Math.PI / 2) : 1 - t;
  const b = curve.equalPower ? Math.sin(t * Math.PI / 2) : t;
  return normalizeLevels(curve.from.map((value, i) => a * value + b * curve.to[i]));
}
