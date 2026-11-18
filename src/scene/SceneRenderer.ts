import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  MathUtils,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  Spherical,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AssetLoader } from "../assets/AssetLoader";
import { disposeObject } from "../assets/dispose";
import type { FaceAppearance, SceneProps } from "../types";
import { CAMERA_LIMITS, MAIN_CAMERA } from "./camera";
import { FrameMonitor } from "./FrameMonitor";
import { benchmarkRender, renderExperiment } from "./renderBenchmark";
import { QualityController } from "./quality";
import { cacheStaticShadows } from "./shadows";
import { ease, SceneClock, sheepPose } from "./sheep/timeline";
import {
  FOG_FAR,
  FOG_NEAR,
  groundHeight,
  minimumCameraHeight,
} from "./terrain";
import { createWorld } from "./world";
type RenderWorld = Awaited<ReturnType<typeof createWorld>>;
type ShadowCache = ReturnType<typeof cacheStaticShadows>;
type ViewportSize = { width: number; height: number; pixelRatio: number };
const RESIZE_SETTLE_MS = 120;

function sameViewport(a: ViewportSize | undefined, b: ViewportSize | undefined) {
  return a === b || (!!a && !!b &&
    a.width === b.width && a.height === b.height && a.pixelRatio === b.pixelRatio);
}

type CameraTransition = {
  from: Vector3;
  target: Vector3;
  to: Vector3;
  end: Vector3;
  start: number;
};
export type SceneHandle = {
  sync(): void;
  home(immediate?: boolean): void;
  reset(): void;
  setFace(face: FaceAppearance | null): void;
  dispose(): void;
};
export function createSceneRenderer(
  host: HTMLDivElement,
  getProps: () => SceneProps,
  setFallback: (fallback: boolean) => void,
  setReady: (ready: boolean) => void,
): SceneHandle | undefined {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
  } catch {
    setFallback(true);
    getProps().onReady(false);
    return;
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.info.autoReset = false;
  let canvas = renderer.domElement;
  canvas.setAttribute(
    "aria-label",
    "Đồi cỏ và cừu 3D. Kéo để xoay, cuộn hoặc chụm hai ngón để thu phóng.",
  );
  canvas.tabIndex = 0;
  host.appendChild(canvas);
  let scene = new Scene();
  scene.background = new Color("#111e3c");
  scene.fog = new Fog("#263e4b", FOG_NEAR, FOG_FAR);
  scene.add(new HemisphereLight(11518936, 5535847, 1.6));
  let moonLight = new DirectionalLight(16770237, 1.35);
  moonLight.position.set(-8, 18, 6);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.setScalar(1024);
  moonLight.shadow.camera.left = moonLight.shadow.camera.bottom = -22;
  moonLight.shadow.camera.right = moonLight.shadow.camera.top = 22;
  moonLight.shadow.camera.far = 65;
  moonLight.shadow.normalBias = 0.055;
  moonLight.shadow.bias = -2e-4;
  moonLight.shadow.radius = 3;
  scene.add(moonLight);
  let backLight = new DirectionalLight(10139364, 0.65);
  backLight.position.set(-10, 8, -14);
  scene.add(backLight);
  let fillLight = new DirectionalLight(10206160, 0.75);
  fillLight.position.set(14, 5, 20);
  scene.add(fillLight);
  scene.add(new AmbientLight(12833503, 0.85));
  let camera = new PerspectiveCamera(MAIN_CAMERA.fov, 1, 0.1, 320),
    orbit = new OrbitControls(camera, canvas);
  orbit.enablePan = false;
  orbit.enableDamping = false;
  orbit.autoRotate = false;
  orbit.minDistance = CAMERA_LIMITS.minDistance;
  orbit.maxDistance = CAMERA_LIMITS.maxDistance;
  orbit.minPolarAngle = CAMERA_LIMITS.minPolarAngle;
  orbit.maxPolarAngle = CAMERA_LIMITS.maxPolarAngle;
  const experiment = renderExperiment(location.search);
  let disposed = false,
    contextLost = false,
    world: RenderWorld | undefined,
    frameRequest = 0,
    previousFrameAt = performance.now(),
    previousStatsAt = 0,
    previousPhase = 4.4,
    renderedFrames = 0,
    ready = false,
    dragging = false,
    shadowPhase = NaN,
    lastShadowAt = -Infinity,
    shadowUpdates = 0,
    shadowCache: ShadowCache | undefined,
    frameMonitor = new FrameMonitor(experiment.enabled ? 3600 : 900);
  Object.assign(host, {
    emFrameSamples: frameMonitor.samples,
  });
  if (experiment.enabled) {
    host.dataset.renderMode = experiment.mode;
    Object.assign(host, {
      async emRenderBenchmark() {
        const viewport = readViewport();
        const dpr = devicePixelRatio;
        const cameraPosition = camera.position.clone();
        const cameraTarget = orbit.target.clone();
        const result = await benchmarkRender(frameMonitor.samples, experiment.mode,
          () => ready && getProps().playing && !getProps().editorOpen && !document.hidden &&
            !disposed && !contextLost && !dragging && !cameraTransition && resizeTimer === undefined &&
            sameViewport(viewport, readViewport()) && devicePixelRatio === dpr &&
            camera.position.equals(cameraPosition) && orbit.target.equals(cameraTarget));
        return { ...result, viewport, dpr, buffer: [canvas.width, canvas.height] };
      },
    });
  }
  let cameraTransition: CameraTransition | undefined,
    assets = new AssetLoader(),
    clock = new SceneClock(performance.now()),
    quality = new QualityController(innerWidth < 700),
    rate = () =>
      getProps().reduced ? 1 : getProps().speed === "medium" ? 1.5 : 1,
    reportCrossings = (kA: { crossings: number }) => {
      for (let nA = 0; nA < kA.crossings; nA++) getProps().onCount();
    };
  let appliedViewport: ViewportSize | undefined;
  let pendingViewport: ViewportSize | undefined;
  let resizeTimer: number | undefined;
  let firstFrameAfterResize = false;
  let resolutionQuery: MediaQueryList;
  let observedDpr = devicePixelRatio;

  function scheduleFrame() {
    !disposed &&
      !contextLost &&
      !document.hidden &&
      !getProps().editorOpen &&
      resizeTimer === undefined &&
      !frameRequest &&
      (frameRequest = requestAnimationFrame(frame));
  }
  function resetCamera(kA = false) {
    shadowPhase = NaN;
    let nA =
      host.clientWidth / host.clientHeight < 0.8
        ? {
            position: [9, 7.5, 24],
            target: [-1.6, 3.4, -1.3],
          }
        : MAIN_CAMERA;
    kA || getProps().reduced
      ? (camera.position.fromArray(nA.position),
        orbit.target.fromArray(nA.target),
        (cameraTransition = void 0),
        orbit.update())
      : (cameraTransition = {
          from: camera.position.clone(),
          target: orbit.target.clone(),
          to: new Vector3(...nA.position),
          end: new Vector3(...nA.target),
          start: performance.now(),
        });
    scheduleFrame();
  }
  function readViewport(): ViewportSize | undefined {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    const ratioLimit = quality.value === "low" ? 0.8 : quality.value === "balanced" ? (width < 700 ? 1 : 1.25) : 1.6;
    return { width, height, pixelRatio: Math.min(devicePixelRatio, ratioLimit) * experiment.scale };
  }

  function applyViewport(size: ViewportSize | undefined) {
    if (!size || sameViewport(appliedViewport, size)) return;
    appliedViewport = size;
    const { width, height, pixelRatio } = size;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    world?.resize(camera.aspect, height);
    // CSS scales the last frame during the drag. Only reallocate the drawing
    // buffer at the settled size, with DPR applied in the same operation.
    renderer.setDrawingBufferSize(width, height, pixelRatio);
  }

  function cancelResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = undefined;
    pendingViewport = undefined;
  }

  function queueResize() {
    if (disposed || contextLost || document.hidden || getProps().editorOpen) return;
    const size = readViewport();
    if (!size || sameViewport(resizeTimer === undefined ? appliedViewport : pendingViewport, size)) return;
    pendingViewport = size;
    if (frameRequest) {
      cancelAnimationFrame(frameRequest);
      frameRequest = 0;
    }
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      cancelResize();
      if (disposed || contextLost || document.hidden || getProps().editorOpen) return;
      applyViewport(readViewport());
      firstFrameAfterResize = true;
      previousFrameAt = performance.now();
      frameMonitor.suspend();
      scheduleFrame();
    }, RESIZE_SETTLE_MS);
  }

  function watchResolution() {
    resolutionQuery?.removeEventListener("change", onResolutionChanged);
    observedDpr = devicePixelRatio;
    resolutionQuery = matchMedia(`(resolution: ${observedDpr}dppx)`);
    resolutionQuery.addEventListener("change", onResolutionChanged);
  }

  function onResolutionChanged() {
    watchResolution();
    queueResize();
  }

  function applyQuality() {
    const level = quality.value;
    moonLight.castShadow = level !== "low";
    renderer.shadowMap.enabled = level !== "low";
    moonLight.shadow.mapSize.setScalar(level === "high" ? 2048 : 1024);
    moonLight.shadow.map?.dispose();
    moonLight.shadow.map = null;
    world?.quality(level);
    applyViewport(readViewport());
    host.dataset.quality = level;
    scheduleFrame();
  }
  function sync() {
    previousFrameAt = performance.now();
    frameMonitor.suspend();
    reportCrossings(
      clock.configure(
        previousFrameAt,
        getProps().playing && !document.hidden && ready,
        rate(),
      ),
    );
    if (getProps().editorOpen) {
      cancelResize();
      if (frameRequest) cancelAnimationFrame(frameRequest);
      frameRequest = 0;
    } else {
      queueResize();
      scheduleFrame();
    }
    if (experiment.enabled) host.dataset.sceneObscured = String(!!getProps().editorOpen);
  }
  function frame(kA: number) {
    let nA = performance.now();
    frameRequest = 0;
    if (disposed || contextLost || document.hidden || getProps().editorOpen || resizeTimer !== undefined || !world || !ready) return;
    let q = clock.sample(nA);
    reportCrossings(q);
    let m = Math.max(0, q.phase - previousPhase);
    previousPhase = q.phase;
    let AA = getProps();
    if (
      (world.actors.forEach((IA, G) => {
        let h = sheepPose(q.phase, G);
        IA.root.position.set(h.x, groundHeight(h.x, h.z) + h.y, h.z);
        IA.root.rotation.y = h.yaw;
        IA.pose(
          !AA.playing && q.phase === 4.4 ? "Idle" : h.state,
          h.clipTime,
          m,
          rate(),
          h.visible,
        );
      }),
      cameraTransition)
    ) {
      let IA = ease((nA - cameraTransition.start) / 900);
      camera.position.lerpVectors(
        cameraTransition.from,
        cameraTransition.to,
        IA,
      );
      orbit.target.lerpVectors(
        cameraTransition.target,
        cameraTransition.end,
        IA,
      );
      orbit.update();
      IA >= 1 && (cameraTransition = void 0);
    }
    camera.position.y = Math.max(
      camera.position.y,
      minimumCameraHeight(camera.position.x, camera.position.z),
    );
    camera.lookAt(orbit.target);
    world.update(q.phase, AA.reduced, camera, q.activeSeconds);
    let Z = nA - previousFrameAt;
    const PA = moonLight.castShadow && (
      !moonLight.shadow.map || Number.isNaN(shadowPhase) ||
      (AA.playing ? nA - lastShadowAt >= experiment.shadowInterval : q.phase !== shadowPhase)
    );
    if (PA) shadowCache?.updateActorBounds();
    renderer.shadowMap.needsUpdate = PA;
    renderer.info.reset();
    let _ = performance.now();
    renderer.render(scene, camera);
    let DA = performance.now() - _;
    if (PA) {
      shadowPhase = q.phase;
      lastShadowAt = nA;
      shadowUpdates++;
    }
    let wA = dragging
      ? AA.playing
        ? "drag-playing"
        : "drag-paused"
      : AA.playing
        ? "playing"
        : "idle";
    frameMonitor.record(
      wA,
      nA,
      DA,
      renderer.info.render.calls,
      renderer.info.render.triangles,
    );
    if (AA.playing && !firstFrameAfterResize && quality.observe(Z, nA)) applyQuality();
    firstFrameAfterResize = false;
    previousFrameAt = nA;
    renderedFrames++;
    (nA - previousStatsAt > 750 || !AA.playing) &&
      (Object.assign(host.dataset, {
        scenePlaying: String(AA.playing),
        entryDoor: world.doorState().entry.toFixed(4),
        exitDoor: world.doorState().exit.toFixed(4),
        barnTriangles: String(world.barnTriangles),
        barnDrawCalls: String(world.barnDrawCalls),
        frameMode: wA,
        staticShadowBakes: String(shadowCache?.bakes || 0),
        dynamicShadowUpdated: String(PA),
        ...(experiment.enabled && { dynamicShadowUpdates: String(shadowUpdates) }),
        drawCalls: String(renderer.info.render.calls),
        triangles: String(renderer.info.render.triangles),
        grassInstances: String(world.grassInstances),
        flowerInstances: String(world.flowerInstances),
        geometries: String(renderer.info.memory.geometries),
        textures: String(renderer.info.memory.textures),
        frameMs: quality.meanMs.toFixed(1),
        frameIntervalMs: Z.toFixed(1),
        renderedFrames: String(renderedFrames),
        sceneTime: q.phase.toFixed(3),
        environmentTime: world.environmentPhase().toFixed(3),
        cameraClearance: (
          camera.position.y - groundHeight(camera.position.x, camera.position.z)
        ).toFixed(3),
        cameraTarget: orbit.target
          .toArray()
          .map((IA) => IA.toFixed(3))
          .join(","),
        actorState: sheepPose(q.phase, 0).state,
        cameraPosition: camera.position
          .toArray()
          .map((IA) => IA.toFixed(3))
          .join(","),
      }),
      (previousStatsAt = nA));
    (AA.playing || cameraTransition) && scheduleFrame();
  }
  let interactionStart = () => {
      cameraTransition = void 0;
      dragging = true;
      frameMonitor.suspend();
    },
    interactionEnd = () => {
      dragging = false;
      frameMonitor.suspend();
    };
  orbit.addEventListener("start", interactionStart);
  orbit.addEventListener("end", interactionEnd);
  orbit.addEventListener("change", scheduleFrame);
  let onKey = (kA: KeyboardEvent) => {
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "+",
        "-",
        "Home",
      ].includes(kA.key)
    )
      if ((kA.preventDefault(), (cameraTransition = void 0), kA.key === "Home"))
        resetCamera();
      else {
        let nA = camera.position.clone().sub(orbit.target),
          q = new Spherical().setFromVector3(nA);
        q.theta +=
          kA.key === "ArrowLeft" ? 0.12 : kA.key === "ArrowRight" ? -0.12 : 0;
        q.phi = MathUtils.clamp(
          q.phi +
            (kA.key === "ArrowUp" ? -0.08 : kA.key === "ArrowDown" ? 0.08 : 0),
          orbit.minPolarAngle,
          orbit.maxPolarAngle,
        );
        q.radius = MathUtils.clamp(
          q.radius * (kA.key === "+" ? 0.9 : kA.key === "-" ? 1.1 : 1),
          orbit.minDistance,
          orbit.maxDistance,
        );
        camera.position
          .copy(orbit.target)
          .add(new Vector3().setFromSpherical(q));
        orbit.update();
        scheduleFrame();
      }
  };
  canvas.addEventListener("keydown", onKey);
  let onVisibility = () => {
    if (document.hidden) cancelResize();
    else queueResize();
    sync();
    previousFrameAt = performance.now();
    document.hidden &&
      frameRequest &&
      (cancelAnimationFrame(frameRequest), (frameRequest = 0));
  };
  document.addEventListener("visibilitychange", onVisibility);
  let onContextLost = (kA: Event) => {
    contextLost = true;
    cancelResize();
    window.clearInterval(resolutionPoll);
    kA.preventDefault();
    setFallback(true);
    setReady(false);
    getProps().onReady(false);
    frameRequest && cancelAnimationFrame(frameRequest);
    frameRequest = 0;
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  let resizeObserver = new ResizeObserver(queueResize);
  resizeObserver.observe(host);
  window.addEventListener("resize", queueResize);
  watchResolution();
  // Chromium DevTools can change DPR without delivering a resize or media event.
  // A scalar check while visible catches that case without touching layout or WebGL.
  const resolutionPoll = window.setInterval(() => {
    if (!document.hidden && devicePixelRatio !== observedDpr) onResolutionChanged();
  }, 250);
  resetCamera(true);
  applyQuality();
  const handle = {
    sync: sync,
    home: resetCamera,
    setFace(face: FaceAppearance | null) {
      if (disposed || !world) return;
      try {
        world.setFace(face);
        host.dataset.personalFace = face ? "true" : "false";
        shadowPhase = NaN;
        scheduleFrame();
      } catch {
        getProps().onFaceError?.("Không thể gắn ảnh lên model cừu này. Mặt cừu hiện tại được giữ nguyên.");
      }
    },
    reset() {
      clock.reset(performance.now());
      previousPhase = 4.4;
      shadowPhase = NaN;
      world?.actors.forEach((kA) => kA.reset());
      sync();
    },
  };
  createWorld(scene, assets)
    .then(async (kA) => {
      if (((world = kA), disposed)) {
        world.disposeActors();
        disposeObject(world.root);
        return;
      }
      handle.setFace(getProps().face ?? null);
      if (
        (world.quality(quality.value),
        world.resize(camera.aspect, host.clientHeight),
        world.update(4.4, getProps().reduced, camera),
        await renderer.compileAsync(scene, camera),
        !disposed)
      ) {
        if (
          ((shadowCache = cacheStaticShadows(
            renderer,
            scene,
            moonLight,
            camera,
            world.dynamicShadowRoots,
          )),
          await renderer.compileAsync(scene, camera),
          disposed)
        ) {
          shadowCache.dispose();
          return;
        }
        ready = true;
        host.dataset.modelSource = "/assets/sheep.glb";
        sync();
        frameRequest && cancelAnimationFrame(frameRequest);
        frame(performance.now());
        setReady(true);
        getProps().onReady(true);
      }
    })
    .catch((kA) => {
      disposed ||
        (console.error("Không thể tải cảnh Êm:", kA),
        setFallback(true),
        getProps().onReady(false));
    });
  return {
    ...handle,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelResize();
      window.clearInterval(resolutionPoll);
      frameRequest && cancelAnimationFrame(frameRequest);
      resizeObserver.disconnect();
      window.removeEventListener("resize", queueResize);
      resolutionQuery.removeEventListener("change", onResolutionChanged);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("keydown", onKey);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      orbit.dispose();
      shadowCache?.dispose();
      world?.disposeActors();
      disposeObject(scene);
      assets.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
