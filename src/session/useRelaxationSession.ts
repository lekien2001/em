import { useEffect, useReducer, useRef, useState, type SetStateAction } from "react";
import { AudioEngine } from "../audio/AudioEngine";
import { sounds } from "../audio/catalog";
import type { FadeSeconds, SoundId } from "../types";
import { copyMix, enabledSounds, mixKey, singleMix, validFade, validMix, type MixConfig, type SessionConfig } from "./config";
import { SessionTimer } from "./SessionTimer";
import { readPreference, writePreference } from "./preferences";
const audioError = "Chưa thể phát âm thanh. Hãy thử lại hoặc chọn âm thanh khác.";
function initialMix() {
  try {
    const value: unknown = JSON.parse(readPreference("mix-v1", "null"));
    if (validMix(value)) return value;
  } catch {/* Migrate legacy selection. */}
  const saved = readPreference("sound", "rain");
  return singleMix(saved === "stream" || saved === "brown" ? saved : "rain");
}
function initialVolume() {
  const v = Number(readPreference("volume", "0.45"));
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : .45;
}
export function useRelaxationSession() {
  const [mix, updateMix] = useState(initialMix),
    [volume, updateVolume] = useState(initialVolume);
  const [timer] = useState(() => {
    const value = new SessionTimer();
    const fade = Number(readPreference("fade-seconds", "15"));
    if (validFade(fade)) value.setFade(fade);
    return value;
  });
  const [, refresh] = useReducer(n => n + 1, 0);
  const [starting, setStarting] = useState(false),
    [error, setError] = useState(""),
    [mixError, setMixError] = useState("");
  const audio = useRef<AudioEngine | null>(null),
    mounted = useRef(true),
    operation = useRef(0),
    mixOperation = useRef(0),
    pending = useRef(false);
  const latestMix = useRef(mix),
    latestVolume = useRef(volume);
  const lastVolume = useRef(Number(readPreference("last-volume", "0.45")));
  if (!(lastVolume.current > 0 && lastVolume.current <= 1)) lastVolume.current = .45;
  if (volume > 0) lastVolume.current = volume;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current++;
      mixOperation.current++;
      audio.current?.dispose();
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    writePreference("mix-v1", JSON.stringify(mix));
    writePreference("sound", enabledSounds(mix)[0]);
  }, [mix]);
  useEffect(() => {
    writePreference("volume", String(volume));
    writePreference("last-volume", String(lastVolume.current));
  }, [volume]);
  useEffect(() => {
    writePreference("fade-seconds", String(timer.fadeSeconds));
  }, [timer.fadeSeconds]);
  function envelope() {
    if (timer.running) audio.current?.envelope(latestVolume.current, timer.remaining, timer.windowMs, timer.recoveryMs, timer.fade);
  }
  function setVolume(value: SetStateAction<number>) {
    const next = Math.max(0, Math.min(1, typeof value === "function" ? value(latestVolume.current) : value));
    latestVolume.current = next;
    if (next > 0) lastVolume.current = next;
    updateVolume(next);
    envelope();
  }
  function toggleMute() {
    setVolume(latestVolume.current > 0 ? 0 : lastVolume.current);
  }
  function setMix(value: MixConfig, transition = .15) {
    if (!validMix(value)) return;
    const next = copyMix(value),
      request = ++mixOperation.current;
    latestMix.current = next;
    updateMix(next);
    setMixError("");
    if (!timer.running || !audio.current) return;
    const engine = audio.current;
    void engine.setMix(next, transition).catch(() => {
      if (!mounted.current || request !== mixOperation.current || audio.current !== engine || !timer.running) return;
      latestMix.current = engine.currentMix;
      updateMix(engine.currentMix);
      setMixError("Chưa thể thêm âm thanh này. Bản phối trước vẫn đang phát; bạn có thể thử lại.");
    });
  }
  function setSound(sound: SoundId) {
    setMix(singleMix(sound, latestMix.current), .8);
  }
  function pause() {
    operation.current++;
    mixOperation.current++;
    pending.current = false;
    setStarting(false);
    timer.pause();
    audio.current?.pause();
    refresh();
  }
  async function toggle() {
    if (pending.current) return;
    if (timer.running) {
      pause();
      return;
    }
    const token = ++operation.current;
    pending.current = true;
    setStarting(true);
    setError("");
    setMixError("");
    try {
      const engine = audio.current ??= new AudioEngine();
      let requested = copyMix(latestMix.current);
      await engine.start(requested);
      while (mounted.current && token === operation.current && mixKey(latestMix.current) !== mixKey(requested)) {
        requested = copyMix(latestMix.current);
        await engine.setMix(requested, .8);
      }
      if (!mounted.current || token !== operation.current || audio.current !== engine) return;
      timer.start();
      envelope();
      refresh();
    } catch {
      if (mounted.current && token === operation.current) {
        audio.current?.pause();
        setError(audioError);
        refresh();
      }
    } finally {
      if (mounted.current && token === operation.current) {
        pending.current = false;
        setStarting(false);
      }
    }
  }
  useEffect(() => {
    if (!timer.running) return;
    const check = () => {
      if (timer.check()) {
        operation.current++;
        pending.current = false;
        audio.current?.pause();
        setStarting(false);
      } else if (timer.remaining !== null && timer.remaining <= timer.windowMs + 1000) {
        // Keep the final envelope on the wall-clock deadline even if the audio
        // device clock drifts. Native automation still runs while timers throttle.
        envelope();
      }
      refresh();
    };
    const visibility = () => {
      check();
      if (!document.hidden) envelope();
    };
    const id = window.setInterval(check, 250);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [timer.running]);
  function changeDuration(minutes: number) {
    timer.configure(minutes);
    envelope();
    refresh();
  }
  function extend(minutes: 5 | 10) {
    if (timer.extend(minutes)) {
      envelope();
      refresh();
    }
  }
  function changeFade(seconds: FadeSeconds) {
    timer.setFade(seconds);
    envelope();
    refresh();
  }
  function getConfiguration(): SessionConfig {
    return {
      mix: copyMix(latestMix.current),
      volume: latestVolume.current,
      lastVolume: lastVolume.current,
      duration: timer.duration,
      fadeSeconds: timer.fadeSeconds
    };
  }
  function applyConfiguration(config: SessionConfig) {
    pause();
    timer.apply(config.duration, config.fadeSeconds);
    latestMix.current = copyMix(config.mix);
    updateMix(latestMix.current);
    lastVolume.current = config.lastVolume;
    latestVolume.current = config.volume;
    updateVolume(config.volume);
    writePreference("last-volume", String(config.lastVolume));
    setError("");
    setMixError("");
    refresh();
  }
  const activeSounds = enabledSounds(mix),
    sound = activeSounds[0];
  return {
    mix,
    setMix,
    sound,
    setSound,
    activeSounds,
    soundLabel: activeSounds.length > 1 ? "Bản phối" : sounds.find(s => s.id === sound)!.label,
    volume,
    setVolume,
    toggleMute,
    playing: timer.running,
    starting,
    toggle,
    duration: timer.duration,
    changeDuration,
    remaining: timer.remaining,
    ended: timer.ended,
    error,
    mixError,
    fade: timer.fade,
    fadeSeconds: timer.fadeSeconds,
    changeFade,
    effectiveFadeMs: timer.windowMs,
    canExtend: (minutes: number) => !starting && timer.canExtend(minutes),
    extend,
    getConfiguration,
    applyConfiguration
  };
}
export type RelaxationSession = ReturnType<typeof useRelaxationSession>;
