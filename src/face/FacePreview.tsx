import { useEffect, useRef, useState } from "react";
import {
  ACESFilmicToneMapping, AmbientLight, DirectionalLight, HemisphereLight,
  PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AssetLoader } from "../assets/AssetLoader";
import { disposeObject } from "../assets/dispose";
import { SheepActor } from "../scene/sheep/SheepActor";
import { FaceAttachment } from "./FaceAttachment";
import { SHEEP_FACE_STYLES } from "./sheepPresets";
import { createFaceSurface, freeCanvas, type Crop } from "./image";
type Props = {
  source: HTMLCanvasElement | null;
  crop: Crop;
  onReady(ready: boolean): void;
};
const PREVIEW_INTERVAL = 1000 / 30;

export function FacePreview(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef(props);
  current.current = props;
  const refresh = useRef<(() => void) | undefined>(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    const element = host.current!;
    const assets = new AssetLoader();
    const scene = new Scene();
    const camera = new PerspectiveCamera(32, 1, .05, 30);
    const measure = new URLSearchParams(location.search).get("qa") === "1";
    const openedAt = performance.now();
    let renderer: WebGLRenderer | undefined;
    let actor: SheepActor | undefined;
    let attachment: FaceAttachment | undefined;
    let controls: OrbitControls | undefined;
    let resize: ResizeObserver | undefined;
    let surface: ReturnType<typeof createFaceSurface> | undefined;
    let compile: Promise<unknown> | undefined;
    let ready = false;
    let disposed = false;
    let failed = false;
    let dirty = true;
    let firstFrame = true;
    let lastPaint = -Infinity;
    let frame = 0;
    let timer: number | undefined;

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      window.clearTimeout(timer);
      timer = undefined;
    };
    const fail = () => {
      if (disposed) return;
      failed = true;
      stop();
      setError("Lúc này chưa thể xem trước 3D. Hãy mở bằng trình duyệt có hỗ trợ WebGL.");
      current.current.onReady(false);
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      fail();
    };
    const invalidate = () => {
      if (ready && !disposed && !failed && !document.hidden && !frame) {
        frame = requestAnimationFrame(render);
      }
    };
    function render() {
      frame = 0;
      if (disposed || failed || document.hidden || !renderer) return;
      const start = performance.now();
      try {
        let updated = false;
        if (dirty && surface && attachment) {
          if (start - lastPaint >= PREVIEW_INTERVAL) {
            const { source, crop } = current.current;
            if (source) surface.paint(source, crop);
            else surface.clear();
            attachment.updatePreview(appearance, !!source);
            dirty = false;
            updated = true;
            lastPaint = start;
            window.clearTimeout(timer);
            timer = undefined;
            if (measure) performance.measure("em:face-preview-crop", { start });
          } else if (timer === undefined) {
            timer = window.setTimeout(() => {
              timer = undefined;
              invalidate();
            }, PREVIEW_INTERVAL - (start - lastPaint));
          }
        }
        if (!updated && dirty && timer !== undefined) return;
        const drawAt = performance.now();
        renderer.render(scene, camera);
        if (measure) {
          performance.measure("em:face-preview-render", { start: drawAt });
          if (firstFrame) performance.measure("em:face-preview-open", { start: openedAt });
        }
        firstFrame = false;
        if (updated) current.current.onReady(true);
      } catch {
        fail();
      }
    }
    refresh.current = () => {
      dirty = true;
      if (timer === undefined) invalidate();
    };
    // The same object identifies the mutable preview texture throughout the editor.
    let appearance: { canvas: HTMLCanvasElement; revision: number };

    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      const canvas = renderer.domElement;
      canvas.tabIndex = 0;
      canvas.setAttribute("aria-label", "Xem trước mặt cừu 3D. Kéo để xoay.");
      canvas.addEventListener("webglcontextlost", contextLost);
      element.appendChild(canvas);
      camera.position.set(0, 1.58, 3.9);
      controls = new OrbitControls(camera, canvas);
      controls.target.set(0, 1.48, .75);
      controls.enablePan = false;
      controls.enableDamping = false;
      controls.minDistance = 2.3;
      controls.maxDistance = 4.2;
      controls.minPolarAngle = .65;
      controls.maxPolarAngle = 1.95;
      controls.update();
      controls.addEventListener("change", invalidate);
      scene.add(new HemisphereLight(0xafc2d8, 0x54787b, 2.3), new AmbientLight(0xc3e3df, .85));
      const light = new DirectionalLight(0xffedcf, 2);
      light.position.set(-3, 5, 5);
      scene.add(light);
      const fill = new DirectionalLight(0xc1d2ed, .7);
      fill.position.set(3, 2, -2);
      scene.add(fill);

      let previousSize = "";
      const size = () => {
        if (!renderer || disposed) return;
        const { clientWidth: width, clientHeight: height } = element;
        const ratio = Math.min(devicePixelRatio, 2);
        const key = `${width}:${height}:${ratio}`;
        if (!width || !height || key === previousSize) return;
        previousSize = key;
        renderer.setDrawingBufferSize(width, height, ratio);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        invalidate();
      };
      resize = new ResizeObserver(size);
      resize.observe(element);
      size();

      void assets.model("sheep-model").then(async model => {
        if (disposed || failed || !renderer) return;
        actor = new SheepActor(model);
        scene.add(actor.root);
        attachment = new FaceAttachment([actor.root], [SHEEP_FACE_STYLES[0]]);
        surface = createFaceSurface("preview");
        appearance = { canvas: surface.canvas, revision: 0 };
        // Three compiles invisible meshes too, including the mapped face surface.
        attachment.updatePreview(appearance, false);
        compile = renderer.compileAsync(scene, camera);
        try {
          await compile;
        } finally {
          compile = undefined;
        }
        if (disposed || failed) return;
        ready = true;
        invalidate();
      }).catch(fail);
    } catch {
      fail();
    }
    const visibility = () => {
      if (document.hidden) stop();
      else invalidate();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      refresh.current = undefined;
      stop();
      document.removeEventListener("visibilitychange", visibility);
      resize?.disconnect();
      controls?.dispose();
      renderer?.domElement.removeEventListener("webglcontextlost", contextLost);
      renderer?.domElement.remove();
      const disposeResources = () => {
        attachment?.dispose();
        actor?.dispose();
        disposeObject(scene);
        assets.dispose();
        freeCanvas(surface?.canvas);
        renderer?.dispose();
        renderer?.forceContextLoss();
      };
      // The shader compiler polls renderer properties. Keep those alive until
      // it settles even if the dialog was dismissed before the first draw.
      if (compile) void compile.then(disposeResources, disposeResources);
      else disposeResources();
    };
  }, []);
  useEffect(() => {
    current.current.onReady(false);
    refresh.current?.();
  }, [props.source, props.crop]);
  return <div className="face-preview-wrap"><div className="face-preview" ref={host} />{error ? <p role="status">{error}</p> : <p className="face-hint">Xem trước · Kéo cừu để xem từ các phía</p>}</div>;
}
