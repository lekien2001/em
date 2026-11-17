import type { SoundId } from "../types";
import { copyMix, enabledSounds, mixKey, singleMix, SOUND_IDS, validMix, type MixConfig } from "../session/config";
import { SoundBank } from "./SoundBank";
import { mixLevels, sampleMix, type MixCurve, type Levels } from "./mix";
type MixVoice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};
/** Bounded loop voices; balance, volume, session fade and pause have separate gains. */
export class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private fadeGain?: GainNode;
  private gate?: GainNode;
  private bank?: SoundBank;
  private voices = new Map<SoundId, MixVoice>();
  private mix = singleMix("rain");
  private curve?: MixCurve;
  private suspendTimer?: ReturnType<typeof setTimeout>;
  private request = 0;
  private playbackRequest = 0;
  private wantedPlaying = false;
  private disposed = false;
  private envelopeStarted = false;
  get currentMix() {
    return copyMix(this.mix);
  }
  get diagnostics() {
    const active = enabledSounds(this.mix);
    return {
      context: this.context?.state ?? "closed",
      audioTime: this.context?.currentTime ?? 0,
      wantedPlaying: this.wantedPlaying,
      activeSound: this.voices.size && active.length === 1 ? active[0] : null,
      activeSounds: this.voices.size ? active : [],
      sessionGain: this.fadeGain?.gain.value ?? 0,
      levels: this.curve && this.context ? sampleMix(this.curve, this.context.currentTime) : [0, 0, 0],
      voices: this.voices.size,
      retired: 0,
      bank: this.bank?.stats ?? null,
      disposed: this.disposed
    };
  }
  async start(input: MixConfig | SoundId) {
    if (this.disposed) throw new Error("Audio engine disposed");
    clearTimeout(this.suspendTimer);
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.fadeGain = this.context.createGain();
      this.gate = this.context.createGain();
      this.master.gain.value = this.gate.gain.value = 0;
      this.master.connect(this.fadeGain).connect(this.gate).connect(this.context.destination);
      this.bank = new SoundBank(this.context);
    }
    this.wantedPlaying = true;
    const playbackRequest = ++this.playbackRequest;
    await this.context.resume();
    if (!this.disposed && this.wantedPlaying && playbackRequest === this.playbackRequest) await this.setMix(typeof input === "string" ? singleMix(input) : input, .8);
  }
  async select(sound: SoundId) {
    await this.setMix(singleMix(sound, this.mix), .8);
  }
  async setMix(mix: MixConfig, duration = .15): Promise<boolean> {
    if (!validMix(mix)) throw new Error("Invalid mix");
    const context = this.context,
      bank = this.bank,
      master = this.master;
    if (!context || !bank || !master || !this.wantedPlaying || this.disposed) return false;
    const request = ++this.request,
      desired = copyMix(mix),
      active = enabledSounds(desired);
    if (mixKey(desired) === mixKey(this.mix) && active.every(id => this.voices.has(id))) return true;
    let buffers: AudioBuffer[];
    try {
      buffers = await Promise.all(active.map(id => bank.get(id)));
    } catch (error) {
      if (this.disposed || !this.wantedPlaying || request !== this.request) return false;
      throw error;
    }
    if (this.disposed || !this.wantedPlaying || request !== this.request) return false;
    const now = context.currentTime;
    active.forEach((id, i) => {
      if (this.voices.has(id)) return;
      const source = context.createBufferSource(),
        gain = context.createGain();
      source.buffer = buffers[i];
      source.loop = true;
      source.loopStart = 2;
      source.loopEnd = 34;
      gain.gain.value = 0;
      source.connect(gain).connect(master);
      source.start(now, 2);
      this.voices.set(id, {
        source,
        gain
      });
    });
    const from: Levels = this.curve ? sampleMix(this.curve, now) : [0, 0, 0];
    const curve: MixCurve = {
      from,
      to: mixLevels(desired),
      at: now,
      duration,
      equalPower: duration >= .8
    };
    SOUND_IDS.forEach((id, index) => {
      const voice = this.voices.get(id);
      if (!voice) return;
      const values = new Float32Array(129);
      for (let i = 0; i < values.length; i++) values[i] = sampleMix(curve, now + duration * i / (values.length - 1))[index];
      voice.gain.gain.cancelAndHoldAtTime(now);
      voice.gain.gain.setValueCurveAtTime(values, now, duration);
    });
    this.curve = curve;
    this.mix = desired;
    return true;
  }
  envelope(volume: number, remaining: number | null, fadeWindow = 15000, recoveryMs = 0, factor?: number) {
    if (!this.context || !this.master || !this.fadeGain || !this.gate) return;
    const now = this.context.currentTime,
      gain = this.master.gain,
      fade = this.fadeGain.gain;
    gain.cancelAndHoldAtTime(now);
    gain.linearRampToValueAtTime(volume, now + .08);
    const target = remaining === null || !fadeWindow ? 1 : Math.max(0, Math.min(1, remaining / fadeWindow));
    fade.cancelAndHoldAtTime(now);
    const initializing = !this.envelopeStarted;
    if (initializing && factor !== undefined) fade.setValueAtTime(factor, now);
    this.envelopeStarted = true;
    const recovery = Math.min(Math.max(initializing && factor !== undefined ? 0 : .08, recoveryMs / 1000), remaining === null ? Infinity : Math.max(0, remaining / 1000));
    const after = remaining === null || !fadeWindow ? 1 : Math.max(0, Math.min(1, (remaining - recovery * 1000) / fadeWindow));
    if (recovery > 0) fade.linearRampToValueAtTime(after, now + recovery);else if (factor === undefined) fade.setValueAtTime(target, now);
    if (remaining !== null && remaining > recovery * 1000) {
      const end = now + remaining / 1000;
      if (remaining > fadeWindow + recovery * 1000) fade.setValueAtTime(1, end - fadeWindow / 1000);
      fade.linearRampToValueAtTime(0, end);
    }
    this.gate.gain.cancelAndHoldAtTime(now);
    this.gate.gain.linearRampToValueAtTime(1, now + .08);
  }
  pause() {
    this.wantedPlaying = false;
    this.playbackRequest++;
    this.request++;
    clearTimeout(this.suspendTimer);
    if (!this.context || !this.gate) return;
    const now = this.context.currentTime;
    this.gate.gain.cancelAndHoldAtTime(now);
    this.gate.gain.linearRampToValueAtTime(0, now + .12);
    this.suspendTimer = setTimeout(() => {
      if (!this.wantedPlaying && !this.disposed) void this.context?.suspend();
    }, 160);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.wantedPlaying = false;
    this.playbackRequest++;
    this.request++;
    clearTimeout(this.suspendTimer);
    this.bank?.dispose();
    this.bank = undefined;
    this.voices.forEach(({
      source,
      gain
    }) => {
      source.stop();
      source.disconnect();
      gain.disconnect();
    });
    this.voices.clear();
    this.master?.disconnect();
    this.fadeGain?.disconnect();
    this.gate?.disconnect();
    void this.context?.close();
    this.context = undefined;
    this.master = this.fadeGain = this.gate = undefined;
  }
}
