import type { Recording } from "./catalog";

const STALL_MS = 5000;
const PREPARE_SECONDS = 3;
const SEEK_FADE = .035;

type Deck = {
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  lifetime: AbortController;
};

function startMedia(deck: Deck, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const { audio } = deck;
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
      audio.removeEventListener("error", failed);
      if (error) reject(error);
      else resolve();
    };
    const cancel = () => finish(new Error("Playback cancelled"));
    const failed = () => finish(new Error("Recording unavailable"));
    const timeout = setTimeout(failed, STALL_MS);
    if (signal.aborted) { cancel(); return; }
    if (audio.error) { failed(); return; }
    signal.addEventListener("abort", cancel, { once: true });
    audio.addEventListener("error", failed, { once: true });
    void audio.play().then(() => finish(), () => failed());
  });
}

/** Keeps native streaming separate from channel gain, with one muted deck ready near the seam. */
export class StreamVoice {
  readonly gain: GainNode;
  private readonly preamp: GainNode;
  private current: Deck;
  private next?: Deck;
  private run?: AbortController;
  private opening?: Promise<void>;
  private clock?: ReturnType<typeof setInterval>;
  private running = false;
  private disposed = false;
  private triedNext = false;
  private endAt?: number;
  private midpoint = 0;
  private seekAt?: number;
  private seekingLoop = false;
  private lastPosition = 0;
  private lastProgress = 0;
  private overlaps = 0;
  private seeks = 0;

  constructor(
    private readonly context: AudioContext,
    private readonly recording: Recording,
    output: AudioNode,
    private readonly fail: () => void,
  ) {
    this.gain = context.createGain();
    this.preamp = context.createGain();
    this.gain.gain.value = 0;
    this.preamp.gain.value = recording.gain;
    this.preamp.connect(this.gain).connect(output);
    this.current = this.createDeck("none", 1);
  }

  private createDeck(preload: "none" | "auto", level: number): Deck {
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = preload;
    audio.loop = true;
    const source = this.context.createMediaElementSource(audio);
    const gain = this.context.createGain();
    const lifetime = new AbortController();
    gain.gain.value = level;
    source.connect(gain).connect(this.preamp);
    const deck = { audio, gain, source, lifetime };
    audio.addEventListener("error", () => {
      if (this.current === deck && this.running) this.checkFailure();
      else if (this.next === deck && this.endAt === undefined) this.dropNext();
    }, { signal: lifetime.signal });
    audio.addEventListener("timeupdate", () => {
      if (this.current === deck) this.tick();
    }, { signal: lifetime.signal });
    audio.src = this.recording.url;
    if (preload === "auto") audio.load();
    audio.currentTime = this.recording.start;
    return deck;
  }

  private release(deck: Deck) {
    deck.lifetime.abort();
    deck.audio.pause();
    deck.audio.removeAttribute("src");
    deck.audio.load();
    deck.source.disconnect();
    deck.gain.disconnect();
  }

  private dropNext() {
    if (this.next) this.release(this.next);
    this.next = undefined;
  }

  play(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error("Recording disposed"));
    if (this.running) return Promise.resolve();
    if (this.opening) return this.opening;
    const run = new AbortController();
    this.run = run;
    this.opening = startMedia(this.current, run.signal).then(() => {
      if (run.signal.aborted) throw new Error("Playback cancelled");
      this.running = true;
      this.lastProgress = performance.now();
      this.lastPosition = this.current.audio.currentTime;
      this.clock = setInterval(() => this.tick(), 35);
    }).finally(() => {
      if (this.run === run) this.opening = undefined;
    });
    return this.opening;
  }

  private decayTo(deck: Deck, level: number, duration: number) {
    const now = this.context.currentTime;
    const gain = deck.gain.gain;
    gain.cancelAndHoldAtTime(now);
    gain.linearRampToValueAtTime(level, now + duration);
  }

  private resetLevel(deck: Deck, level: number) {
    deck.gain.gain.cancelScheduledValues(0);
    deck.gain.gain.setValueAtTime(level, this.context.currentTime);
  }

  private promote() {
    if (!this.next) return;
    this.release(this.current);
    this.current = this.next;
    this.next = undefined;
    this.resetLevel(this.current, 1);
    this.endAt = undefined;
    this.triedNext = false;
    this.lastPosition = this.current.audio.currentTime;
    this.lastProgress = performance.now();
    this.overlaps++;
  }

  private transition(next: Deck) {
    this.triedNext = true;
    void startMedia(next, next.lifetime.signal).then(() => {
      if (next !== this.next || !this.running || this.seekAt !== undefined) return;
      const duration = Math.min(this.recording.overlap, this.recording.end - this.current.audio.currentTime);
      if (duration < .045 || next.audio.error) { this.dropNext(); return; }
      const now = this.context.currentTime;
      const fadeIn = new Float32Array(65), fadeOut = new Float32Array(65);
      for (let i = 0; i < fadeIn.length; i++) {
        const angle = i * Math.PI / (2 * (fadeIn.length - 1));
        fadeIn[i] = Math.sin(angle);
        fadeOut[i] = Math.cos(angle);
      }
      next.gain.gain.setValueCurveAtTime(fadeIn, now, duration);
      this.current.gain.gain.setValueCurveAtTime(fadeOut, now, duration);
      this.endAt = now + duration;
      this.midpoint = now + duration / 2;
    }).catch(() => { if (next === this.next) this.dropNext(); });
  }

  private checkFailure() {
    if (this.next && this.endAt !== undefined && !this.next.audio.error && !this.next.audio.paused) this.promote();
    else { this.pause(); this.fail(); }
  }

  private tick() {
    if (!this.running) return;
    const now = this.context.currentTime;
    if (this.endAt !== undefined) {
      if (!this.next || this.next.audio.error || this.next.audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        this.endAt = undefined;
        this.dropNext();
        this.resetLevel(this.current, 1);
      } else if (now >= this.endAt) this.promote();
      else return;
    }
    const { audio } = this.current;
    const position = audio.currentTime;
    const wrapped = position < this.lastPosition - 1;
    if (Math.abs(position - this.lastPosition) > .005) {
      this.lastPosition = position;
      this.lastProgress = performance.now();
    }
    if (audio.error || performance.now() - this.lastProgress >= STALL_MS) {
      this.checkFailure();
      return;
    }
    if (this.seekingLoop) {
      if (!audio.seeking && audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        this.seekingLoop = false;
        this.decayTo(this.current, 1, SEEK_FADE);
      }
      return;
    }
    if (this.seekAt !== undefined && now >= this.seekAt) {
      this.seekAt = undefined;
      this.seekingLoop = true;
      this.lastProgress = performance.now();
      this.triedNext = false;
      audio.currentTime = this.recording.start;
      this.seeks++;
      return;
    }
    const remaining = this.recording.end - position;
    if (!this.triedNext && !this.next && remaining <= PREPARE_SECONDS && remaining > 0)
      this.next = this.createDeck("auto", 0);
    if ((wrapped && position < this.recording.start) || remaining <= .06) {
      if (this.seekAt === undefined) {
        this.dropNext();
        this.decayTo(this.current, 0, SEEK_FADE);
        this.seekAt = now + SEEK_FADE;
      }
    } else if (remaining <= this.recording.overlap && this.next && !this.triedNext && !audio.seeking) {
      this.transition(this.next);
    }
  }

  pause() {
    this.run?.abort();
    this.run = undefined;
    this.opening = undefined;
    clearInterval(this.clock);
    this.running = false;
    if (this.endAt !== undefined && this.context.currentTime >= this.midpoint) this.promote();
    this.dropNext();
    this.current.audio.pause();
    this.endAt = undefined;
    this.seekAt = undefined;
    this.seekingLoop = false;
    this.triedNext = false;
    this.resetLevel(this.current, 1);
  }

  get diagnostics() {
    return {
      position: this.current.audio.currentTime,
      elements: this.next ? 2 : 1,
      running: this.running,
      overlapping: this.endAt !== undefined,
      overlaps: this.overlaps,
      seeks: this.seeks,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.pause();
    this.disposed = true;
    this.release(this.current);
    this.preamp.disconnect();
    this.gain.disconnect();
  }
}
