import type { RecordingId, SoundId, SynthSoundId } from "../types";
import { copyMix, enabledSounds, mixKey, singleMix, SOUND_IDS, validMix, type MixConfig } from "../session/config";
import { getRecording, isRecording } from "./catalog";
import { SoundBank } from "./SoundBank";
import { StreamVoice } from "./StreamVoice";
import { mixLevels, sampleMix, type MixCurve } from "./mix";
type SynthVoice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};
const silentLevels = () => SOUND_IDS.map(() => 0);
/** Bounded loop voices; balance, volume, session fade and pause have separate gains. */
export class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private fadeGain?: GainNode;
  private gate?: GainNode;
  private bank?: SoundBank;
  private synth = new Map<SynthSoundId, SynthVoice>();
  private recordings = new Map<RecordingId, StreamVoice>();
  private retirements = new Map<RecordingId, ReturnType<typeof setTimeout>>();
  private unavailable = new Set<RecordingId>();
  private audible: SoundId[] = [];
  private mix = singleMix("rain");
  private targetMix = this.mix;
  private curve?: MixCurve;
  private suspendTimer?: ReturnType<typeof setTimeout>;
  private request = 0;
  private wantedPlaying = false;
  private disposed = false;
  private envelopeStarted = false;
  constructor(private readonly reportAvailability?: (missing: RecordingId[], usingRain: boolean) => void) {}
  get currentMix() {
    return copyMix(this.mix);
  }
  get diagnostics() {
    return {
      context: this.context?.state ?? "closed",
      audioTime: this.context?.currentTime ?? 0,
      wantedPlaying: this.wantedPlaying,
      activeSound: this.audible.length === 1 ? this.audible[0] : null,
      activeSounds: [...this.audible],
      sessionGain: this.fadeGain?.gain.value ?? 0,
      levels: this.curve && this.context ? sampleMix(this.curve, this.context.currentTime) : silentLevels(),
      voices: this.synth.size + this.recordings.size,
      recordings: Object.fromEntries([...this.recordings].map(([id, voice]) => [id, voice.diagnostics])),
      unavailable: [...this.unavailable],
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
    // Start media.play() on the same user gesture as AudioContext.resume().
    const [, committed] = await Promise.all([
      this.context.resume(),
      this.setMix(typeof input === "string" ? singleMix(input) : input, .8, true),
    ]);
    return committed;
  }
  async select(sound: SoundId) {
    await this.setMix(singleMix(sound, this.mix), .8, sound);
  }

  private releaseRecording(id: RecordingId) {
    clearTimeout(this.retirements.get(id));
    this.retirements.delete(id);
    this.recordings.get(id)?.dispose();
    this.recordings.delete(id);
  }

  private recordingFailed(id: RecordingId, voice: StreamVoice) {
    if (!this.wantedPlaying || this.recordings.get(id) !== voice || !this.audible.includes(id)) return;
    this.unavailable.add(id);
    this.releaseRecording(id);
    void this.setMix(this.targetMix).catch(() => {
      if (this.wantedPlaying && !this.disposed && this.targetMix[id].enabled)
        this.reportAvailability?.([...this.unavailable], false);
    });
  }

  private async prepareRecording(id: RecordingId, context: AudioContext, output: AudioNode) {
    if (this.unavailable.has(id)) return false;
    try {
      clearTimeout(this.retirements.get(id));
      this.retirements.delete(id);
      let voice = this.recordings.get(id);
      if (!voice) {
        const recording = new StreamVoice(context, getRecording(id), output, () => this.recordingFailed(id, recording));
        voice = recording;
        this.recordings.set(id, recording);
      }
      await voice.play();
      return this.recordings.get(id) === voice && voice.diagnostics.running;
    } catch {
      return false;
    }
  }

  async setMix(mix: MixConfig, duration = .15, retry?: true | SoundId): Promise<boolean> {
    if (!validMix(mix)) throw new Error("Invalid mix");
    const context = this.context,
      bank = this.bank,
      master = this.master;
    if (!context || !bank || !master || !this.wantedPlaying || this.disposed) return false;
    const request = ++this.request,
      desired = copyMix(mix),
      active = enabledSounds(desired);
    this.targetMix = desired;
    for (const id of this.unavailable)
      if (retry === true || retry === id || !desired[id].enabled) this.unavailable.delete(id);
    for (const id of this.recordings.keys())
      if (!desired[id].enabled && !this.audible.includes(id) && !this.retirements.has(id)) this.releaseRecording(id);
    const stillCurrent = () => !this.disposed && this.wantedPlaying && request === this.request;
    if (mixKey(desired) === mixKey(this.mix) && active.every(id => isRecording(id)
      ? this.recordings.get(id)?.diagnostics.running : this.synth.has(id))) return true;
    const buffers = new Map<SynthSoundId, AudioBuffer>();
    const missing: RecordingId[] = [];
    let effective: MixConfig;
    try {
      const ready = await Promise.all(active.map(async id => {
        if (isRecording(id)) return this.prepareRecording(id, context, master);
        if (!this.synth.has(id)) buffers.set(id, await bank.get(id));
        return true;
      }));
      if (!stillCurrent()) return false;
      effective = copyMix(desired);
      active.forEach((id, i) => {
        if (isRecording(id) && (!ready[i] || !this.recordings.get(id)?.diagnostics.running)) {
          missing.push(id);
          effective[id].enabled = false;
        }
      });
      if (missing.length === active.length) {
        effective = singleMix("rain", desired);
        if (!this.synth.has("rain")) buffers.set("rain", await bank.get("rain"));
      }
    } catch (error) {
      if (!stillCurrent()) return false;
      this.targetMix = this.mix;
      for (const id of this.recordings.keys())
        if (!this.audible.includes(id) && !this.retirements.has(id)) this.releaseRecording(id);
      throw error;
    }
    if (!stillCurrent()) return false;
    for (const id of missing) {
      this.unavailable.add(id);
      this.releaseRecording(id);
    }
    const now = context.currentTime;
    for (const [id, buffer] of buffers) {
      if (this.synth.has(id)) continue;
      const source = context.createBufferSource(),
        gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = 2;
      source.loopEnd = 34;
      gain.gain.value = 0;
      source.connect(gain).connect(master);
      source.start(now, 2);
      this.synth.set(id, {
        source,
        gain
      });
    }
    const from = this.curve ? sampleMix(this.curve, now) : silentLevels();
    const curve: MixCurve = {
      from,
      to: mixLevels(effective),
      at: now,
      duration,
      equalPower: duration >= .8
    };
    SOUND_IDS.forEach((id, index) => {
      const voice = isRecording(id) ? this.recordings.get(id) : this.synth.get(id);
      if (!voice) return;
      const values = new Float32Array(129);
      for (let i = 0; i < values.length; i++) values[i] = sampleMix(curve, now + duration * i / (values.length - 1))[index];
      voice.gain.gain.cancelAndHoldAtTime(now);
      voice.gain.gain.setValueCurveAtTime(values, now, duration);
    });
    for (const id of this.recordings.keys()) {
      if (effective[id].enabled) continue;
      clearTimeout(this.retirements.get(id));
      this.retirements.set(id, setTimeout(() => this.releaseRecording(id), (duration + .04) * 1000));
    }
    this.curve = curve;
    this.audible = enabledSounds(effective);
    this.mix = desired;
    this.reportAvailability?.(missing, missing.length === active.length);
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
    this.request++;
    for (const [id, voice] of this.recordings) {
      if (this.audible.includes(id)) voice.pause();
      else this.releaseRecording(id);
    }
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
    this.request++;
    clearTimeout(this.suspendTimer);
    this.bank?.dispose();
    this.bank = undefined;
    for (const id of this.recordings.keys()) this.releaseRecording(id);
    this.unavailable.clear();
    this.audible = [];
    this.synth.forEach(({
      source,
      gain
    }) => {
      source.stop();
      source.disconnect();
      gain.disconnect();
    });
    this.synth.clear();
    this.master?.disconnect();
    this.fadeGain?.disconnect();
    this.gate?.disconnect();
    void this.context?.close();
    this.context = undefined;
    this.master = this.fadeGain = this.gate = undefined;
  }
}
