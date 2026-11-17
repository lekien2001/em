import { AudioEngine } from "../../src/audio/AudioEngine";
import { SoundBank } from "../../src/audio/SoundBank";
import { synthesizePreset } from "../../src/audio/synthesis";
import { createVoice, fadeVoice } from "../../src/audio/voice";
import type { SoundId } from "../../src/types";
const engine = new AudioEngine();
let starting = false,
  error = "";
const api = {
  async start(sound: SoundId = "rain") {
    starting = true;
    error = "";
    try {
      await engine.start(sound);
      engine.envelope(0.45, null);
    } catch (e) {
      error = String(e);
    } finally {
      starting = false;
    }
  },
  select: (sound: SoundId) => engine.select(sound),
  pause: () => engine.pause(),
  dispose: () => engine.dispose(),
  stats: () => ({ ...engine.diagnostics, starting, error }),
  async parity(sound: SoundId, sampleRate: number, seed: number) {
    const context = new OfflineAudioContext(2, 1, sampleRate),
      bank = new SoundBank(context, seed);
    try {
      const buffer = await bank.get(sound),
        iterator = synthesizePreset({
          sound,
          sampleRate,
          seed:
            (seed ^
              { rain: 0xa63f25b1, stream: 0x4a1d38f7, brown: 0xc3748139 }[
                sound
              ]) >>>
            0,
        });
      let item = iterator.next();
      while (!item.done) item = iterator.next();
      let maxError = 0;
      for (let ch = 0; ch < 2; ch++) {
        const actual = buffer.getChannelData(ch),
          expected = ch ? item.value.right : item.value.left;
        for (let i = 0; i < actual.length; i++)
          maxError = Math.max(maxError, Math.abs(actual[i] - expected[i]));
      }
      return { maxError, ...bank.stats };
    } finally {
      bank.dispose();
    }
  },
  async curves() {
    const context = new OfflineAudioContext(2, 48000 * 3, 48000),
      buffer = context.createBuffer(1, 48000 * 34, 48000);
    buffer.getChannelData(0).fill(0.2);
    const channels = context.createChannelMerger(2),
      a = context.createGain(),
      b = context.createGain();
    a.connect(channels, 0, 0);
    b.connect(channels, 0, 1);
    channels.connect(context.destination);
    const first = createVoice(context, buffer, "rain", a, 0);
    createVoice(context, buffer, "stream", b, 1);
    fadeVoice(first, 1, "out");
    first.source.stop(1.82);
    const rendered = await context.startRendering(),
      left = rendered.getChannelData(0),
      right = rendered.getChannelData(1);
    return [1, 1.2, 1.4, 1.6, 1.799].map((t) => {
      const i = Math.round(t * 48000);
      return {
        time: t,
        left: left[i],
        right: right[i],
        power: left[i] ** 2 + right[i] ** 2,
      };
    });
  },
  async envelope() {
    const context = new OfflineAudioContext(1, 48000 * 30, 48000),
      master = context.createGain(),
      buffer = context.createBuffer(1, 128, 48000),
      source = context.createBufferSource();
    buffer.getChannelData(0).fill(1);
    source.buffer = buffer;
    source.loop = true;
    source.connect(master).connect(context.destination);
    master.gain.value = 0;
    // Native OfflineAudioContext exercises the actual automation method.
    const probe = new AudioEngine() as unknown as {
      context: BaseAudioContext;
      master: GainNode;
      envelope: (v: number, t: number | null) => void;
    };
    probe.context = context;
    probe.master = master;
    probe.envelope(0.6, 30000);
    source.start();
    const rendered = await context.startRendering(),
      data = rendered.getChannelData(0);
    return [1, 14, 15, 22.5, 29.99].map((time) => ({
      time,
      value: data[Math.round(time * 48000)],
    }));
  },
};
Object.assign(window, { __audioTest: api });
for (const sound of ["rain", "stream", "brown"] as const) {
  const button = document.createElement("button");
  button.textContent = "Start " + sound;
  button.onclick = () => {
    void api.start(sound);
  };
  document.body.append(button);
}
