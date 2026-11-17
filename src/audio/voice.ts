import type { SoundId } from "../types";
export type Voice = {
  sound: SoundId;
  source: AudioBufferSourceNode;
  gain: GainNode;
  at: number;
  duration: number;
  from: number;
  direction: "in" | "out";
  disposed: boolean;
};
export function voiceLevel(voice: Voice, time: number) {
  const t = Math.max(0, Math.min(1, (time - voice.at) / voice.duration));
  return voice.direction === "in"
    ? Math.sin(t * Math.PI * 0.5)
    : voice.from * Math.cos(t * Math.PI * 0.5);
}
/** Constant-power curves keep unrelated, calibrated noise beds level in a mix. */
export function fadeVoice(
  voice: Voice,
  now: number,
  direction: "in" | "out",
  duration = 0.8,
) {
  const from = direction === "out" ? voiceLevel(voice, now) : 0,
    curve = new Float32Array(129);
  for (let i = 0; i < curve.length; i++) {
    const t = i / (curve.length - 1);
    curve[i] =
      direction === "in"
        ? Math.sin(t * Math.PI * 0.5)
        : from * Math.cos(t * Math.PI * 0.5);
  }
  voice.gain.gain.cancelAndHoldAtTime(now);
  voice.gain.gain.setValueCurveAtTime(curve, now, duration);
  voice.at = now;
  voice.direction = direction;
  voice.duration = duration;
  voice.from = from;
}
export function createVoice(
  context: BaseAudioContext,
  buffer: AudioBuffer,
  sound: SoundId,
  output: AudioNode,
  now = context.currentTime,
): Voice {
  const source = context.createBufferSource(),
    gain = context.createGain();
  source.buffer = buffer;
  source.loop = true;
  source.loopStart = 2;
  source.loopEnd = 34;
  gain.gain.value = 0;
  source.connect(gain).connect(output);
  const voice: Voice = {
    sound,
    source,
    gain,
    at: now,
    duration: 0.8,
    from: 0,
    direction: "in",
    disposed: false,
  };
  fadeVoice(voice, now, "in");
  source.start(now, 2);
  return voice;
}
export function disconnectVoice(voice: Voice, now?: number) {
  if (voice.disposed) return;
  voice.disposed = true;
  voice.source.onended = null;
  try {
    voice.source.stop(now);
  } catch {
    /* It may already have ended. */
  }
  voice.source.disconnect();
  voice.gain.disconnect();
}
