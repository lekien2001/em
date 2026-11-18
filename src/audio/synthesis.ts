import type { SynthSoundId } from "../types";
export type SynthesisRequest = {
  sound: SynthSoundId;
  sampleRate: number;
  seed: number;
};
export type RenderedSound = {
  left: Float32Array<ArrayBuffer>;
  right: Float32Array<ArrayBuffer>;
  sampleRate: number;
  loopStart: number;
  loopEnd: number;
};
/** Self-contained generator: its compiled function is also the inline worker.
 * No captured imports/constants; each yield bounds main-thread fallback work. */
export function* synthesizePreset(
  request: SynthesisRequest,
): Generator<void, RenderedSound, void> {
  const { sound, seed } = request;
  if (
    !["rain", "stream", "brown"].includes(sound) ||
    !Number.isFinite(request.sampleRate) ||
    request.sampleRate < 8000
  )
    throw new Error("Invalid synthesis request");
  const sampleRate = Math.min(48000, request.sampleRate),
    length = Math.round(sampleRate * 34),
    overlap = Math.round(sampleRate * 2),
    left = new Float32Array(length),
    right = new Float32Array(length);
  let state = seed >>> 0 || 0x76a9c123;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const coefficient = (hz: number) =>
    1 - Math.exp((-2 * Math.PI * hz) / sampleRate);
  const lowA = coefficient(sound === "brown" ? 20 : 90),
    midA = coefficient(sound === "rain" ? 550 : 280),
    highA = coefficient(
      sound === "rain" ? 3300 : sound === "stream" ? 1700 : 500,
    );
  const color = () => {
    let low = 0,
      mid = 0,
      high = 0,
      brown = 0,
      dc = 0;
    return (white: number) => {
      if (sound === "brown") {
        brown = 0.9995 * brown + 0.025 * white;
        dc += lowA * (brown - dc);
        high += highA * (brown - dc - high);
        return high;
      }
      low += lowA * (white - low);
      mid += midA * (white - mid);
      high += highA * (white - high);
      return sound === "rain"
        ? 0.2 * low + 0.3 * mid + 0.5 * high
        : 0.42 * low + 0.38 * mid + 0.2 * high;
    };
  };
  const common = color(),
    diffuseL = color(),
    diffuseR = color();
  const phase = random() * Math.PI * 2,
    driftA = coefficient(0.13),
    grainA = coefficient(sound === "rain" ? 90 : 18),
    decay = Math.exp(-1 / (sampleRate * (sound === "rain" ? 0.025 : 0.12)));
  let drift = 1,
    target = 1,
    nextChange = 0,
    grain = 0,
    grainTarget = 0;
  for (let i = 0; i < length; i++) {
    if (i >= nextChange) {
      target = 0.87 + random() * 0.26;
      nextChange = i + Math.floor(sampleRate * (2 + random() * 5));
    }
    drift += driftA * (target - drift);
    if (
      sound !== "brown" &&
      random() < (sound === "rain" ? 32 : 1.3) / sampleRate
    )
      grainTarget +=
        sound === "rain" ? 0.055 + random() * 0.06 : 0.18 + random() * 0.12;
    grainTarget *= decay;
    grain += grainA * (grainTarget - grain);
    const t = i / sampleRate,
      flow =
        sound === "stream"
          ? 1 +
            0.07 * Math.sin(t * 0.39 + phase) +
            0.04 * Math.sin(t * 0.23 + phase * 0.7)
          : 1;
    const bed = common(random() * 2 - 1),
      l = diffuseL(random() * 2 - 1),
      r = diffuseR(random() * 2 - 1);
    const level = sound === "brown" ? 1 : drift * flow * (1 + grain);
    left[i] = (bed + 0.32 * l) * level;
    right[i] = (bed + 0.32 * r) * level;
    if ((i & 8191) === 8191) yield;
  }
  // Raised-cosine tail joins the pre-roll. LoopStart skips pre-roll on playback.
  for (let i = 0; i < overlap; i++) {
    const mix = 0.5 - 0.5 * Math.cos((Math.PI * i) / (overlap - 1)),
      at = length - overlap + i;
    left[at] = left[at] * (1 - mix) + left[i] * mix;
    right[at] = right[at] * (1 - mix) + right[i] * mix;
    if ((i & 8191) === 8191) yield;
  }
  for (const data of [left, right]) {
    let mean = 0;
    for (let i = overlap; i < length; i++) {
      mean += data[i];
      if ((i & 8191) === 8191) yield;
    }
    mean /= length - overlap;
    let sum = 0,
      peak = 0;
    for (let i = 0; i < length; i++) {
      data[i] -= mean;
      if (i >= overlap) {
        sum += data[i] * data[i];
        peak = Math.max(peak, Math.abs(data[i]));
      }
      if ((i & 8191) === 8191) yield;
    }
    const rms = Math.sqrt(sum / (length - overlap)),
      gain = Math.min(
        Math.pow(10, -24 / 20) / Math.max(rms, 1e-12),
        0.5 / Math.max(peak, 1e-12),
      );
    for (let i = 0; i < length; i++) {
      data[i] *= gain;
      if ((i & 8191) === 8191) yield;
    }
  }
  return { left, right, sampleRate, loopStart: 2, loopEnd: 34 };
}
