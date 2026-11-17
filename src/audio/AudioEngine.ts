import type { SoundId } from "../types";
type Voice = {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
};
/** Procedural audio, separate from React and the scene. Times use AudioContext. */
export class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private voice?: Voice;
  private buffers = new Map<SoundId, AudioBuffer>();
  private retired = new Set<Voice>();
  private suspendTimer?: ReturnType<typeof setTimeout>;
  async start(sound: SoundId) {
    clearTimeout(this.suspendTimer);
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.context.destination);
    }
    await this.context.resume();
    this.select(sound);
  }
  select(sound: SoundId) {
    const context = this.context,
      master = this.master;
    if (!context || !master) return;
    let buffer = this.buffers.get(sound);
    if (!buffer) {
      buffer = context.createBuffer(
        2,
        context.sampleRate * 8,
        context.sampleRate,
      );
      for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        let brown = 0;
        for (let i = 0; i < data.length; i++) {
          const white = Math.random() * 2 - 1;
          brown = (brown + 0.025 * white) / 1.025;
          data[i] =
            sound === "brown"
              ? brown * 3.8
              : sound === "stream"
                ? white * 0.28 +
                  brown *
                    (1 +
                      0.35 *
                        Math.sin((i / context.sampleRate) * Math.PI * 2 * 0.5))
                : white * 0.38;
        }
        const overlap = Math.floor(context.sampleRate * 0.15);
        for (let i = 0; i < overlap; i++) {
          const mix = i / overlap;
          data[data.length - overlap + i] =
            data[data.length - overlap + i] * (1 - mix) + data[i] * mix;
        }
      }
      this.buffers.set(sound, buffer);
    }
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0.15;
    filter.type = "lowpass";
    filter.frequency.value =
      sound === "brown" ? 500 : sound === "stream" ? 1900 : 3600;
    filter.Q.value = 0.25;
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(master);
    const now = context.currentTime;
    gain.gain.linearRampToValueAtTime(1, now + 0.65);
    source.start(0, 0.15);
    const previous = this.voice;
    if (previous) {
      previous.gain.gain.cancelAndHoldAtTime(now);
      previous.gain.gain.linearRampToValueAtTime(0, now + 0.65);
      previous.source.stop(now + 0.7);
      this.retired.add(previous);
      previous.source.onended = () => {
        this.disconnect(previous);
        this.retired.delete(previous);
      };
    }
    this.voice = {
      source,
      filter,
      gain,
    };
  }
  envelope(volume: number, remaining: number | null) {
    if (!this.context || !this.master) return;
    const gain = this.master.gain,
      now = this.context.currentTime;
    gain.cancelAndHoldAtTime(now);
    const fade =
      remaining === null ? 1 : Math.min(1, Math.max(0, remaining / 15000));
    gain.linearRampToValueAtTime(volume * fade, now + 0.08);
    if (remaining !== null && remaining > 80) {
      const end = now + remaining / 1000;
      if (remaining > 15000) gain.setValueAtTime(volume, end - 15);
      gain.linearRampToValueAtTime(0, end);
    }
  }
  pause() {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelAndHoldAtTime(now);
    this.master.gain.linearRampToValueAtTime(0, now + 0.12);
    this.suspendTimer = setTimeout(() => {
      void this.context?.suspend();
    }, 160);
  }
  private disconnect(voice: Voice) {
    voice.source.onended = null;
    voice.source.disconnect();
    voice.filter.disconnect();
    voice.gain.disconnect();
  }
  dispose() {
    clearTimeout(this.suspendTimer);
    this.retired.forEach((voice) => this.disconnect(voice));
    this.retired.clear();
    if (this.voice) this.disconnect(this.voice);
    void this.context?.close();
    this.context = undefined;
    this.master = undefined;
    this.voice = undefined;
    this.buffers.clear();
  }
}
