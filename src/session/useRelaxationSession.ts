import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine } from "../audio/AudioEngine";
import type { DurationMinutes, SoundId } from "../types";
import { readPreference, writePreference } from "./preferences";
const audioError =
  "Chưa thể phát âm thanh. Hãy thử lại hoặc chọn âm thanh khác.";
export function useRelaxationSession() {
  const [sound, setSound] = useState<SoundId>(() => {
    const saved = readPreference("sound", "rain");
    return saved === "stream" || saved === "brown" ? saved : "rain";
  });
  const [volume, setVolume] = useState(() => {
    const value = Number(readPreference("volume", "0.45"));
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.45;
  });
  const lastVolume = useRef(0);
  if (lastVolume.current === 0) {
    const saved = Number(readPreference("last-volume", "0.45"));
    lastVolume.current = volume > 0 ? volume : Number.isFinite(saved) && saved > 0 && saved <= 1 ? saved : 0.45;
  }
  const [playing, setPlaying] = useState(false),
    [starting, setStarting] = useState(false);
  const [duration, setDuration] = useState<DurationMinutes>(30),
    [remaining, setRemaining] = useState<number | null>(30 * 60000);
  const [ended, setEnded] = useState(false),
    [error, setError] = useState("");
  const audio = useRef<AudioEngine | null>(null),
    deadline = useRef<number | null>(null),
    pending = useRef(false),
    mounted = useRef(true);
  // Async preparation must use the latest controls, not the click's old render.
  const latest = useRef({ sound, volume, duration, remaining, ended });
  latest.current = { sound, volume, duration, remaining, ended };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      audio.current?.dispose();
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    writePreference("sound", sound);
  }, [sound]);
  useEffect(() => {
    writePreference("volume", String(volume));
    if (volume > 0) {
      lastVolume.current = volume;
    }
    writePreference("last-volume", String(lastVolume.current));
  }, [volume]);
  function toggleMute() {
    setVolume(current => {
      if (current > 0) { lastVolume.current = current; return 0; }
      return lastVolume.current;
    });
  }
  useEffect(() => {
    if (!playing) return;
    const engine = audio.current;
    if (!engine) return;
    let cancelled = false;
    void engine?.select(sound).catch(() => {
      if (cancelled || !mounted.current || audio.current !== engine) return;
      if (deadline.current !== null)
        setRemaining(Math.max(0, deadline.current - Date.now()));
      deadline.current = null;
      engine.pause();
      setPlaying(false);
      setError(audioError);
    });
    return () => {
      cancelled = true;
    };
  }, [sound, playing]);
  useEffect(() => {
    if (playing)
      audio.current?.envelope(
        volume,
        deadline.current === null
          ? null
          : Math.max(0, deadline.current - Date.now()),
      );
  }, [volume, playing, duration]);
  const checkDeadline = useCallback(() => {
    if (deadline.current === null) return;
    const left = Math.max(0, deadline.current - Date.now());
    setRemaining(left);
    if (left === 0) {
      deadline.current = null;
      audio.current?.pause();
      setPlaying(false);
      setEnded(true);
    }
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(checkDeadline, 250);
    document.addEventListener("visibilitychange", checkDeadline);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", checkDeadline);
    };
  }, [playing, checkDeadline]);
  async function toggle() {
    if (pending.current) return;
    if (playing) {
      if (deadline.current !== null)
        setRemaining(Math.max(0, deadline.current - Date.now()));
      deadline.current = null;
      audio.current?.pause();
      setPlaying(false);
      return;
    }
    pending.current = true;
    setStarting(true);
    setError("");
    try {
      const engine = (audio.current ??= new AudioEngine());
      let requested = latest.current.sound;
      await engine.start(requested);
      while (
        mounted.current &&
        audio.current === engine &&
        latest.current.sound !== requested
      ) {
        requested = latest.current.sound;
        await engine.select(requested);
      }
      if (!mounted.current || audio.current !== engine) return;
      const config = latest.current,
        left = config.ended
          ? config.duration === 0
            ? null
            : config.duration * 60000
          : config.remaining;
      setRemaining(left);
      deadline.current = left === null ? null : Date.now() + left;
      engine.envelope(config.volume, left);
      setEnded(false);
      setPlaying(true);
    } catch {
      if (mounted.current) {
        audio.current?.pause();
        setError(audioError);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setStarting(false);
    }
  }
  function changeDuration(minutes: DurationMinutes) {
    setDuration(minutes);
    const left = minutes === 0 ? null : minutes * 60000;
    setRemaining(left);
    setEnded(false);
    deadline.current = playing && left !== null ? Date.now() + left : null;
  }
  return {
    sound,
    setSound,
    volume,
    setVolume,
    toggleMute,
    playing,
    starting,
    toggle,
    duration,
    changeDuration,
    remaining,
    ended,
    error,
    fade: remaining === null ? 1 : Math.min(1, Math.max(0, remaining / 15000)),
  };
}
export type RelaxationSession = ReturnType<typeof useRelaxationSession>;
