import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine } from "../audio/AudioEngine";
import type { DurationMinutes, SoundId } from "../types";
import { readPreference, writePreference } from "./preferences";
export function useRelaxationSession() {
  const [sound, setSound] = useState<SoundId>(() => {
    const saved = readPreference("sound", "rain");
    return saved === "stream" || saved === "brown" ? saved : "rain";
  });
  const [volume, setVolume] = useState(() => {
    const n = Number(readPreference("volume", "0.45"));
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.45;
  });
  const [playing, setPlaying] = useState(false),
    [starting, setStarting] = useState(false);
  const [duration, setDuration] = useState<DurationMinutes>(30),
    [remaining, setRemaining] = useState<number | null>(30 * 60000);
  const [ended, setEnded] = useState(false),
    [error, setError] = useState("");
  const audio = useRef<AudioEngine | null>(null),
    deadline = useRef<number | null>(null);
  const pending = useRef(false),
    mounted = useRef(true);
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
  }, [volume]);
  useEffect(() => {
    if (playing) audio.current?.select(sound);
  }, [sound]);
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
      await engine.start(sound);
      if (!mounted.current || audio.current !== engine) return;
      const left = ended
        ? duration === 0
          ? null
          : duration * 60000
        : remaining;
      setRemaining(left);
      deadline.current = left === null ? null : Date.now() + left;
      engine.envelope(volume, left);
      setEnded(false);
      setPlaying(true);
    } catch {
      if (mounted.current)
        setError(
          "Chưa thể phát âm thanh. Hãy thử lại hoặc chọn âm thanh khác.",
        );
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
