import type { SynthSoundId } from "../types";
import {
  synthesizePreset,
  type RenderedSound,
  type SynthesisRequest,
} from "./synthesis";
type Job = {
  resolve: (sound: RenderedSound) => void;
  reject: (error: Error) => void;
};
const cancelled = () => new Error("Sound preparation cancelled");
/** At most one buffer per preset, owned by one audio context. No PCM copies are
 * retained after converting transferred worker arrays to AudioBuffer. */
export class SoundBank {
  private buffers = new Map<SynthSoundId, Promise<AudioBuffer>>();
  private jobs = new Map<number, Job>();
  private worker?: Worker;
  private workerUrl?: string;
  private workerFailed = false;
  private disposed = false;
  private serial = 0;
  private readonly seed: number;
  constructor(
    private context: BaseAudioContext,
    seed?: number,
  ) {
    this.seed = seed ?? Math.floor(Math.random() * 4294967296);
  }
  get stats() {
    return {
      cached: this.buffers.size,
      pending: this.jobs.size,
      workerAlive: !!this.worker,
      mode: this.worker ? "worker" : this.workerFailed ? "fallback" : "idle",
      disposed: this.disposed,
    };
  }
  get(sound: SynthSoundId): Promise<AudioBuffer> {
    if (this.disposed) return Promise.reject(cancelled());
    const cached = this.buffers.get(sound);
    if (cached) return cached;
    const seed =
      (this.seed ^
        { rain: 0xa63f25b1, stream: 0x4a1d38f7, brown: 0xc3748139 }[sound]) >>>
      0;
    const request = {
      sound,
      sampleRate: Math.min(48000, this.context.sampleRate),
      seed,
    };
    const promise = this.generate(request)
      .then((data) => {
        if (this.disposed) throw cancelled();
        const buffer = this.context.createBuffer(
          2,
          data.left.length,
          data.sampleRate,
        );
        buffer.copyToChannel(data.left, 0);
        buffer.copyToChannel(data.right, 1);
        return buffer;
      })
      .catch((error) => {
        if (this.buffers.get(sound) === promise) this.buffers.delete(sound);
        throw error;
      });
    this.buffers.set(sound, promise);
    return promise;
  }
  private ensureWorker() {
    if (this.worker || this.workerFailed) return;
    try {
      // The generator contains its helpers. ES2022 preserves it without runtime
      // bundler helpers; parity tests compare worker output to the pure generator.
      const code = `const synthesize=${synthesizePreset.toString()};onmessage=e=>{const {id,request}=e.data;try{const iterator=synthesize(request);let item=iterator.next();while(!item.done)item=iterator.next();const data=item.value;postMessage({id,data},[data.left.buffer,data.right.buffer]);}catch(error){postMessage({id,error:String(error)});}};`;
      this.workerUrl = URL.createObjectURL(
        new Blob([code], { type: "application/javascript" }),
      );
      this.worker = new Worker(this.workerUrl);
      this.worker.onmessage = (
        event: MessageEvent<{
          id: number;
          data?: RenderedSound;
          error?: string;
        }>,
      ) => {
        const job = this.jobs.get(event.data.id);
        if (!job) return;
        this.jobs.delete(event.data.id);
        if (event.data.error || !event.data.data) {
          const error = new Error(event.data.error ?? "Invalid worker output");
          job.reject(error);
          this.disableWorker(error);
        } else job.resolve(event.data.data);
      };
      this.worker.onerror = (event) => {
        event.preventDefault();
        this.disableWorker(new Error("Audio worker unavailable"));
      };
    } catch {
      this.disableWorker(new Error("Audio worker unavailable"));
    }
  }
  private disableWorker(error: Error) {
    this.workerFailed = true;
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.terminate();
      this.worker = undefined;
    }
    if (this.workerUrl) {
      URL.revokeObjectURL(this.workerUrl);
      this.workerUrl = undefined;
    }
    const pending = [...this.jobs.values()];
    this.jobs.clear();
    pending.forEach((job) => job.reject(error));
  }
  private async generate(request: SynthesisRequest): Promise<RenderedSound> {
    this.ensureWorker();
    if (this.worker) {
      try {
        return await new Promise<RenderedSound>((resolve, reject) => {
          const id = ++this.serial;
          this.jobs.set(id, { resolve, reject });
          try {
            this.worker!.postMessage({ id, request });
          } catch (error) {
            this.jobs.delete(id);
            reject(error);
          }
        });
      } catch (error) {
        if (this.disposed) throw cancelled();
        this.disableWorker(
          error instanceof Error
            ? error
            : new Error("Audio worker unavailable"),
        );
      }
    }
    const iterator = synthesizePreset(request);
    let item = iterator.next(),
      chunks = 0;
    // MessageChannel yields are independent of the session clock and browser
    // timers. They also work when timer tests advance Date/performance manually.
    const channel = new MessageChannel();
    let wake: (() => void) | undefined;
    channel.port1.onmessage = () => {
      const resolve = wake;
      wake = undefined;
      resolve?.();
    };
    try {
      while (!item.done) {
        if (this.disposed) throw cancelled();
        if ((++chunks & 3) === 0)
          await new Promise<void>((resolve) => {
            wake = resolve;
            channel.port2.postMessage(0);
          });
        item = iterator.next();
      }
      if (this.disposed) throw cancelled();
      return item.value;
    } finally {
      channel.port1.close();
      channel.port2.close();
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.disableWorker(cancelled());
    this.buffers.clear();
  }
}
