import { test, expect } from "@playwright/test";
import { synthesizePreset } from "../src/audio/synthesis";
import type { SoundId } from "../src/types";
function render(sound: SoundId, sampleRate: number, seed: number) {
  const iterator = synthesizePreset({ sound, sampleRate, seed });
  let next = iterator.next();
  while (!next.done) next = iterator.next();
  return next.value;
}
for (const sampleRate of [44100, 48000])
  for (const sound of ["rain", "stream", "brown"] as const)
    test(`${sound} ${sampleRate}: finite, calibrated, DC-free and seamless`, () => {
      const data = render(sound, sampleRate, 0x378b1a45);
      expect(data.loopEnd - data.loopStart).toBe(32);
      let leftEnergy = 0,
        rightEnergy = 0,
        cross = 0;
      for (const [channelIndex, channel] of [data.left, data.right].entries()) {
        let sum = 0,
          squares = 0,
          peak = 0,
          deltaEnergy = 0,
          maxDelta = 0;
        const start = data.loopStart * sampleRate;
        for (let i = start; i < channel.length; i++) {
          const value = channel[i];
          if (!Number.isFinite(value)) throw Error("Non-finite audio");
          sum += value;
          squares += value * value;
          peak = Math.max(peak, Math.abs(value));
          if (i > start) {
            const d = channel[i] - channel[i - 1];
            deltaEnergy += d * d;
            maxDelta = Math.max(maxDelta, Math.abs(d));
          }
        }
        const rms = Math.sqrt(squares / (channel.length - start)),
          db = 20 * Math.log10(rms),
          seam = Math.abs(channel[start] - channel[channel.length - 1]);
        expect(Math.abs(sum / (channel.length - start))).toBeLessThan(0.00001);
        expect(db).toBeGreaterThanOrEqual(-26);
        expect(db).toBeLessThanOrEqual(-22);
        expect(peak).toBeLessThanOrEqual(0.500001);
        expect(seam).toBeLessThan(maxDelta * 1.05);
        expect(seam).toBeLessThan(
          Math.sqrt(deltaEnergy / (channel.length - start)) * 6,
        );
        if (sound === "brown")
          expect(
            Math.sqrt(deltaEnergy / (channel.length - start)) / rms,
          ).toBeLessThan(0.15);
        console.log(
          JSON.stringify({
            sound,
            sampleRate,
            channel: channelIndex,
            rmsDb: db,
            peakDb: 20 * Math.log10(peak),
            dc: sum / (channel.length - start),
            seam,
          }),
        );
      }
      for (let i = sampleRate * 2; i < data.left.length; i += 8) {
        leftEnergy += data.left[i] ** 2;
        rightEnergy += data.right[i] ** 2;
        cross += data.left[i] * data.right[i];
      }
      const correlation = cross / Math.sqrt(leftEnergy * rightEnergy);
      expect(correlation).toBeGreaterThan(0.7);
      expect(correlation).toBeLessThan(0.99);
    });
test("seeded generator is deterministic and different presets are distinct", () => {
  const a = render("rain", 8000, 42),
    b = render("rain", 8000, 42),
    c = render("stream", 8000, 42);
  expect(Buffer.from(a.left.buffer).equals(Buffer.from(b.left.buffer))).toBe(
    true,
  );
  expect(Buffer.from(a.left.buffer).equals(Buffer.from(c.left.buffer))).toBe(
    false,
  );
});
