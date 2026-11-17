import { AudioEngine } from "../../src/audio/AudioEngine";
import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  WebGLRenderer,
  Mesh,
  Points,
  Sprite,
  SkinnedMesh,
  Texture,
  type Object3D,
} from "three";
import { App } from "../../src/app/App";
import {
  createSceneRenderer,
  type SceneHandle,
} from "../../src/scene/SceneRenderer";
import type { SceneProps } from "../../src/types";
let root: Root | undefined,
  scene: SceneHandle | undefined,
  ready = false,
  host: HTMLDivElement | undefined;
let latestAudio: AudioEngine | undefined;
const envelopes: { volume: number; remaining: number | null }[] = [];
const originalEnvelope = AudioEngine.prototype.envelope;
AudioEngine.prototype.envelope = function (volume, remaining) {
  envelopes.push({ volume, remaining });
  return originalEnvelope.call(this, volume, remaining);
};
const originalStart = AudioEngine.prototype.start;
AudioEngine.prototype.start = function (
  ...args: Parameters<AudioEngine["start"]>
) {
  latestAudio = this;
  return originalStart.apply(this, args);
};
const renderers = new Set<WebGLRenderer>(),
  counts: Record<string, number> = {},
  objects = new WeakSet<object>();
let serial = 0;
const render = WebGLRenderer.prototype.render;
WebGLRenderer.prototype.render = function (
  ...args: Parameters<WebGLRenderer["render"]>
) {
  renderers.add(this);
  return render.apply(this, args);
};
const pending = new Set<number>(),
  raf = window.requestAnimationFrame.bind(window),
  cancel = window.cancelAnimationFrame.bind(window);
window.requestAnimationFrame = (callback) => {
  const id = raf((time) => {
    pending.delete(id);
    callback(time);
  });
  pending.add(id);
  return id;
};
window.cancelAnimationFrame = (id) => {
  pending.delete(id);
  cancel(id);
};
const fixture = document.getElementById("root")!;
const callbacks: { ready: boolean[]; fallback: boolean[] } = {
  ready: [],
  fallback: [],
};
const props: SceneProps = {
  playing: false,
  reduced: false,
  speed: "slow",
  reset: 0,
  sessionId: 0,
  onCount() {},
  onReady(value) {
    callbacks.ready.push(value);
  },
};
function watch(value: {
  addEventListener: (type: "dispose", cb: () => void) => unknown;
}) {
  if (objects.has(value)) return;
  objects.add(value);
  const key = String(++serial);
  counts[key] = 0;
  value.addEventListener("dispose", () => counts[key]++);
}
Object.assign(window, {
  __emLifecycle: {
    mountApp() {
      root = createRoot(fixture);
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>,
      );
    },
    unmountApp() {
      root?.unmount();
      root = undefined;
    },
    mountScene() {
      ready = false;
      host = document.createElement("div");
      host.className = "canvas-host";
      fixture.appendChild(host);
      scene = createSceneRenderer(
        host,
        () => props,
        (value) => callbacks.fallback.push(value),
        (value) => {
          ready = value;
        },
      );
    },
    disposeScene() {
      scene?.dispose();
      scene?.dispose();
      host?.remove();
    },
    capture() {
      const qa = (
        window as unknown as { __emQA: { world: { root: Object3D } } }
      ).__emQA;
      qa.world.root.traverse((node) => {
        if (node instanceof Mesh || node instanceof Points) {
          watch(node.geometry);
          if (node instanceof SkinnedMesh && node.skeleton.boneTexture)
            watch(node.skeleton.boneTexture);
        }
        if (
          node instanceof Mesh ||
          node instanceof Points ||
          node instanceof Sprite
        )
          for (const mat of Array.isArray(node.material)
            ? node.material
            : [node.material]) {
            watch(mat);
            Object.values(mat).forEach((v) => {
              if (v instanceof Texture) watch(v);
            });
          }
      });
      return Object.keys(counts).length;
    },
    status() {
      return {
        envelopes,
        audio: latestAudio?.diagnostics ?? null,
        ready,
        callbacks,
        counts,
        pendingFrames: pending.size,
        canvases: fixture.querySelectorAll("canvas").length,
        data: host ? { ...host.dataset } : {},
        renderers: [...renderers].map((r) => ({ ...r.info.memory })),
      };
    },
  },
});
