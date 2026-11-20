import type { RecordingId, SoundId, SynthSoundId } from "../types";
import { copyMix, enabledSounds, singleMix, SOUND_IDS, validMix, type MixConfig } from "../session/config";
import { getRecording, isRecording } from "./catalog";
import { SoundBank } from "./SoundBank";
import { StreamVoice } from "./StreamVoice";
import { mixLevels, sampleMix, type MixCurve } from "./mix";
type SynthVoice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};
export type ChannelStatus = "loading" | "playing" | "unavailable";
export type PlaybackStatus = {
  channels: Partial<Record<SoundId, ChannelStatus>>;
  fallbackRain: boolean;
};
type FirstSound = {
  resolve: (started: boolean) => void;
  reject: (error: unknown) => void;
};
const FALLBACK_AFTER_MS = 1000;
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
  private unavailable = new Set<SoundId>();
  private rampedGains = new WeakSet<GainNode>();
  private audible: SoundId[] = [];
  private playback: PlaybackStatus = { channels: {}, fallbackRain: false };
  private mix = singleMix("rain");
  private targetMix = this.mix;
  private curve?: MixCurve;
  private suspendTimer?: ReturnType<typeof setTimeout>;
  private fallbackTimer?: ReturnType<typeof setTimeout>;
  private fallbackAt = 0;
  private firstSound?: FirstSound;
  private request = 0;
  private wantedPlaying = false;
  private disposed = false;
  private envelopeStarted = false;
  constructor(
    private readonly reportPlayback?: (status: PlaybackStatus) => void,
    private readonly expired = () => false,
  ) {}
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
      playback: this.playback,
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
    const mix = typeof input === "string" ? singleMix(input) : input;
    if (!validMix(mix)) throw new Error("Invalid mix");
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
    this.firstSound?.resolve(false);
    const first = new Promise<boolean>((resolve, reject) => { this.firstSound = { resolve, reject }; });
    this.fallbackAt = performance.now() + FALLBACK_AFTER_MS;
    // Start media.play() on the same user gesture as AudioContext.resume().
    const resumed = this.context.resume();
    void this.setMix(mix, .8, true).catch(() => { /* Startup failures also reject first. */ });
    const [, started] = await Promise.all([resumed, first]);
    return started;
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
    void this.setMix(this.targetMix).catch(() => { /* The failed channel stays unavailable. */ });
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

  private isReady(id: SoundId) {
    return isRecording(id) ? !!this.recordings.get(id)?.diagnostics.running : this.synth.has(id);
  }

  private addSynth(id: SynthSoundId, buffer: AudioBuffer, context: AudioContext, master: AudioNode) {
    if (this.synth.has(id)) return;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 2;
    source.loopEnd = 34;
    gain.gain.value = 0;
    source.connect(gain).connect(master);
    source.start(context.currentTime, 2);
    this.synth.set(id, { source, gain });
  }

  private publish(channels: PlaybackStatus["channels"], fallbackRain: boolean) {
    if (fallbackRain === this.playback.fallbackRain && SOUND_IDS.every(id => channels[id] === this.playback.channels[id])) return;
    this.playback = { channels, fallbackRain };
    this.reportPlayback?.(this.playback);
  }

  private applyReadyMix(mix: MixConfig, duration: number, context: AudioContext) {
    const now = context.currentTime;
    const to = mixLevels(mix);
    const gains = SOUND_IDS.map(id => (isRecording(id) ? this.recordings.get(id) : this.synth.get(id))?.gain);
    const previous = this.curve;
    const changed = !previous || to.some((level, i) => {
      const gain = gains[i];
      return level !== previous.to[i] || (level > 0 && !!gain && !this.rampedGains.has(gain));
    });
    if (changed) {
      const from = previous ? sampleMix(previous, now) : silentLevels();
      const curve: MixCurve = {
        from: gains.map((gain, i) => gain && this.rampedGains.has(gain) ? from[i] : 0),
        to,
        at: now,
        duration,
        equalPower: duration >= .8,
      };
      const samples = Array.from({ length: 129 }, (_, i) => sampleMix(curve, now + duration * i / 128));
      gains.forEach((gain, index) => {
        if (!gain) return;
        gain.gain.cancelAndHoldAtTime(now);
        gain.gain.setValueCurveAtTime(Float32Array.from(samples, levels => levels[index]), now, duration);
        this.rampedGains.add(gain);
      });
      this.curve = curve;
    }
    for (const id of this.recordings.keys()) {
      if (this.targetMix[id].enabled || (!changed && this.retirements.has(id))) continue;
      clearTimeout(this.retirements.get(id));
      this.retirements.set(id, setTimeout(() => this.releaseRecording(id), (duration + .04) * 1000));
    }
    this.audible = enabledSounds(mix);
    this.firstSound?.resolve(true);
    this.firstSound = undefined;
  }

  async setMix(mix: MixConfig, duration = .15, retry?: true | SoundId): Promise<boolean> {
    if (!validMix(mix)) throw new Error("Invalid mix");
    const { context, bank, master } = this;
    if (!context || !bank || !master || !this.wantedPlaying || this.disposed || this.expired()) return false;
    clearTimeout(this.fallbackTimer);
    const request = ++this.request;
    const desired = this.targetMix = copyMix(mix);
    const active = enabledSounds(desired);
    const opening = !!this.firstSound;
    const hasRecording = active.some(isRecording);
    const stillCurrent = () => !this.disposed && this.wantedPlaying && request === this.request && !this.expired();
    for (const id of this.unavailable)
      if (retry === true || retry === id || !desired[id].enabled) this.unavailable.delete(id);
    for (const id of this.recordings.keys())
      if (!desired[id].enabled && (this.firstSound || (!this.audible.includes(id) && !this.retirements.has(id)))) this.releaseRecording(id);

    const readyMix = (selection: MixConfig) => {
      const ready = copyMix(selection);
      for (const id of enabledSounds(ready)) ready[id].enabled = this.isReady(id);
      return ready;
    };
    const reconcile = () => {
      const available = readyMix(desired);
      const channels: PlaybackStatus["channels"] = {};
      for (const id of active) {
        channels[id] = available[id].enabled ? "playing" : this.unavailable.has(id) ? "unavailable" : "loading";
      }
      const anyReady = enabledSounds(available).length > 0;
      if (anyReady) {
        clearTimeout(this.fallbackTimer);
        this.applyReadyMix(available, this.playback.fallbackRain ? .8 : duration, context);
      }
      this.publish(channels, !anyReady && this.playback.fallbackRain);
    };

    // Only a fresh start with a recording needs the one-second safety net.
    // Warm the existing synth buffer without creating an audible source yet.
    const shouldWarmRain = opening && hasRecording && !active.some(id => this.isReady(id));
    const warmedRain = shouldWarmRain && !this.synth.has("rain") ? bank.get("rain").catch(() => undefined) : undefined;
    let fallback: Promise<void> | undefined;
    const startFallback = () => fallback ??= (async () => {
      if (!stillCurrent() || active.some(id => this.isReady(id))) return;
      if (!this.synth.has("rain")) {
        const buffer = (await warmedRain) ?? await bank.get("rain");
        if (!stillCurrent() || active.some(id => this.isReady(id))) return;
        this.addSynth("rain", buffer, context, master);
      }
      if (desired.rain.enabled) {
        this.unavailable.delete("rain");
        reconcile();
        return;
      }
      this.applyReadyMix(singleMix("rain", desired), .8, context);
      this.publish(this.playback.channels, true);
    })();
    if (shouldWarmRain) this.fallbackTimer = setTimeout(() => {
      void startFallback().catch(() => { /* A recording can still become ready. */ });
    }, Math.max(0, this.fallbackAt - performance.now()));

    let synthError: unknown;
    try {
      reconcile();
      // Each task becomes audible independently. This Promise only tracks when
      // the latest mix has finished loading, not when playback can start.
      await Promise.all(active.map(async id => {
        if (isRecording(id)) {
          const ready = await this.prepareRecording(id, context, master);
          if (!stillCurrent()) return;
          if (!ready) {
            this.unavailable.add(id);
            this.releaseRecording(id);
          }
        } else if (!this.synth.has(id) && !this.unavailable.has(id)) {
          const buffer = await bank.get(id).catch(error => {
            if (!opening && retry !== id) throw error;
            synthError ??= error;
            if (stillCurrent()) this.unavailable.add(id);
            return undefined;
          });
          if (!stillCurrent()) return;
          if (buffer) this.addSynth(id, buffer, context, master);
        }
        reconcile();
      }));
      if (!stillCurrent()) return false;
      if (!active.some(id => this.isReady(id))) {
        if (!hasRecording) throw synthError ?? new Error("No audio channels available");
        await startFallback();
      }
      if (!stillCurrent()) return false;
      this.mix = desired;
      return true;
    } catch (error) {
      if (!stillCurrent()) return false;
      this.request++;
      clearTimeout(this.fallbackTimer);
      this.targetMix = this.mix;
      for (const id of this.recordings.keys())
        if (!this.mix[id].enabled) this.releaseRecording(id);
      const restored = readyMix(this.mix);
      const audible = enabledSounds(restored);
      if (audible.length && !this.firstSound) this.applyReadyMix(restored, duration, context);
      this.publish(Object.fromEntries(audible.map(id => [id, "playing"])), false);
      this.firstSound?.reject(error);
      this.firstSound = undefined;
      throw error;
    }
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
    clearTimeout(this.fallbackTimer);
    this.firstSound?.resolve(false);
    this.firstSound = undefined;
    this.publish({}, false);
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
    clearTimeout(this.fallbackTimer);
    this.firstSound?.resolve(false);
    this.firstSound = undefined;
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
