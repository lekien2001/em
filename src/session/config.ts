import type { FadeSeconds, SheepSpeed, SoundId } from "../types";
export const SOUND_IDS: SoundId[] = ["rain", "stream", "brown"];
export type MixConfig = Record<SoundId, {
  enabled: boolean;
  level: number;
}>;
export type SessionConfig = {
  mix: MixConfig;
  volume: number;
  lastVolume: number;
  duration: number;
  fadeSeconds: FadeSeconds;
};
export type FavoriteConfig = SessionConfig & {
  speed: SheepSpeed;
  reduced: boolean;
  showCount: boolean;
};
export const copyMix = (mix: MixConfig): MixConfig => ({
  rain: {
    ...mix.rain
  },
  stream: {
    ...mix.stream
  },
  brown: {
    ...mix.brown
  }
});
export function singleMix(id: SoundId, previous?: MixConfig): MixConfig {
  return Object.fromEntries(SOUND_IDS.map(sound => [sound, {
    enabled: sound === id,
    level: sound === id ? 1 : previous?.[sound].level ?? .5
  }])) as MixConfig;
}
export const enabledSounds = (mix: MixConfig) => SOUND_IDS.filter(id => mix[id].enabled);
export const mixKey = (mix: MixConfig) => SOUND_IDS.map(id => `${+mix[id].enabled}:${mix[id].level}`).join("|");
export const validDuration = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 720;
export const validFade = (v: unknown): v is FadeSeconds => v === 15 || v === 60 || v === 180;
export function validMix(value: unknown): value is MixConfig {
  const mix = value as MixConfig | null;
  return !!mix && SOUND_IDS.every(id => typeof mix[id]?.enabled === "boolean" && Number.isFinite(mix[id].level) && mix[id].level >= .01 && mix[id].level <= 1) && enabledSounds(mix).length > 0;
}
export function validFavoriteConfig(value: unknown): value is FavoriteConfig {
  const c = value as FavoriteConfig | null;
  return !!c && validMix(c.mix) && Number.isFinite(c.volume) && c.volume >= 0 && c.volume <= 1 && Number.isFinite(c.lastVolume) && c.lastVolume > 0 && c.lastVolume <= 1 && validDuration(c.duration) && validFade(c.fadeSeconds) && (c.speed === "slow" || c.speed === "medium") && typeof c.reduced === "boolean" && typeof c.showCount === "boolean";
}
export function formatRemaining(ms: number | null) {
  if (ms === null) return "∞";
  const seconds = Math.max(0, Math.floor(ms / 1000)),
    minutes = Math.floor(seconds / 60);
  return seconds >= 3600 ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
