import type { SoundId } from "../types";
import { SoundBank } from "./SoundBank";
import { createVoice, disconnectVoice, fadeVoice, type Voice } from "./voice";
/** Owns playback only. Sound generation lives in SoundBank and a Blob worker. */
export class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private bank?: SoundBank;
  private voice?: Voice;
  private retired = new Set<Voice>();
  private suspendTimer?: ReturnType<typeof setTimeout>;
  private request = 0;
  private wantedPlaying = false;
  private disposed = false;
  get diagnostics() {
    return {
      context: this.context?.state ?? "closed",
      audioTime: this.context?.currentTime ?? 0,
      wantedPlaying: this.wantedPlaying,
      activeSound: this.voice?.sound ?? null,
      voices: (this.voice ? 1 : 0) + this.retired.size,
      retired: this.retired.size,
      bank: this.bank?.stats ?? null,
      disposed: this.disposed,
    };
  }
  async start(sound: SoundId) {
    if (this.disposed) throw new Error("Audio engine disposed");
    clearTimeout(this.suspendTimer);
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.context.destination);
      this.bank = new SoundBank(this.context);
    }
    this.wantedPlaying = true;
    // Resume synchronously from the trusted click, before worker preparation.
    await this.context.resume();
    if (this.disposed || !this.wantedPlaying) return;
    await this.select(sound);
  }
  async select(sound: SoundId): Promise<void> {
    const context = this.context,
      master = this.master,
      bank = this.bank;
    if (!context || !master || !bank || !this.wantedPlaying || this.disposed)
      return;
    const request = ++this.request;
    if (this.voice?.sound === sound) return;
    let buffer: AudioBuffer;
    try {
      buffer = await bank.get(sound);
    } catch (error) {
      if (this.disposed || !this.wantedPlaying || request !== this.request)
        return;
      throw error;
    }
    if (this.disposed || !this.wantedPlaying || request !== this.request)
      return;
    const now = context.currentTime,
      previous = this.voice;
    this.voice = createVoice(context, buffer, sound, master, now);
    if (previous) {
      fadeVoice(previous, now, "out");
      previous.source.stop(now + 0.82);
      this.retired.add(previous);
      previous.source.onended = () => {
        disconnectVoice(previous);
        this.retired.delete(previous);
      };
    }
  }
  envelope(volume: number, remaining: number | null) {
    if (!this.context || !this.master) return;
    const gain = this.master.gain,
      now = this.context.currentTime,
      fade =
        remaining === null ? 1 : Math.min(1, Math.max(0, remaining / 15000));
    gain.cancelAndHoldAtTime(now);
    gain.linearRampToValueAtTime(volume * fade, now + 0.08);
    if (remaining !== null && remaining > 80) {
      const end = now + remaining / 1000;
      if (remaining > 15000) gain.setValueAtTime(volume, end - 15);
      gain.linearRampToValueAtTime(0, end);
    }
  }
  pause() {
    this.wantedPlaying = false;
    this.request++;
    clearTimeout(this.suspendTimer);
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelAndHoldAtTime(now);
    this.master.gain.linearRampToValueAtTime(0, now + 0.12);
    this.suspendTimer = setTimeout(() => {
      if (this.wantedPlaying || this.disposed || !this.context) return;
      this.retired.forEach((voice) => disconnectVoice(voice));
      this.retired.clear();
      if (this.voice) {
        const gain = this.voice.gain.gain;
        gain.cancelAndHoldAtTime(this.context.currentTime);
        gain.setValueAtTime(1, this.context.currentTime);
        this.voice.at = this.context.currentTime - 1;
        this.voice.direction = "in";
      }
      void this.context.suspend();
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
    this.retired.forEach((voice) => disconnectVoice(voice));
    this.retired.clear();
    if (this.voice) disconnectVoice(this.voice);
    this.voice = undefined;
    this.master?.disconnect();
    void this.context?.close();
    this.context = undefined;
    this.master = undefined;
  }
}
