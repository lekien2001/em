import { useEffect, useRef, useState } from "react";
import { ACESFilmicToneMapping, AmbientLight, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AssetLoader } from "../assets/AssetLoader";
import { disposeObject } from "../assets/dispose";
import { SheepActor } from "../scene/sheep/SheepActor";
import { FaceAttachment } from "./FaceAttachment";
import { exportFace, freeCanvas, type Crop } from "./image";
type Props = {
  source: HTMLCanvasElement | null;
  crop: Crop;
  onReady(ready: boolean): void;
};
export function FacePreview(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    current = useRef(props);
  current.current = props;
  const refresh = useRef<(() => void) | undefined>(undefined);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = host.current!,
      assets = new AssetLoader();
    let renderer: WebGLRenderer | undefined, actor: SheepActor | undefined, attachment: FaceAttachment | undefined;
    let controls: OrbitControls | undefined, resize: ResizeObserver | undefined;
    let output: HTMLCanvasElement | undefined,
      frame = 0,
      disposed = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const scene = new Scene(),
      camera = new PerspectiveCamera(32, 1, .05, 30);
    const render = () => {
      frame = 0;
      if (!disposed && renderer && !document.hidden) renderer.render(scene, camera);
    };
    const invalidate = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(render);
    };
    const fail = () => {
      if (!disposed) {
        setError("Lúc này chưa thể xem trước 3D. Hãy mở bằng trình duyệt có hỗ trợ WebGL.");
        current.current.onReady(false);
      }
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      fail();
    };
    try {
      renderer = new WebGLRenderer({
        antialias: true,
        alpha: true
      });
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
      const size = () => {
        if (!renderer || disposed) return;
        const width = element.clientWidth,
          height = element.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        invalidate();
      };
      resize = new ResizeObserver(size);
      resize.observe(element);
      size();
      void assets.model("sheep-model").then(model => {
        if (disposed) return;
        actor = new SheepActor(model);
        scene.add(actor.root);
        attachment = new FaceAttachment([actor.root]);
        refresh.current = () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            if (disposed || !attachment) return;
            try {
              const {
                  source,
                  crop
                } = current.current,
                next = source ? exportFace(source, crop) : undefined;
              attachment.set(next ? {
                canvas: next,
                revision: 0
              } : null);
              freeCanvas(output);
              output = next;
              invalidate();
              current.current.onReady(true);
            } catch {
              fail();
            }
          }, 80);
        };
        refresh.current();
      }).catch(fail);
    } catch {
      fail();
    }
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else invalidate();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      refresh.current = undefined;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      resize?.disconnect();
      controls?.dispose();
      attachment?.dispose();
      actor?.dispose();
      disposeObject(scene);
      assets.dispose();
      freeCanvas(output);
      if (renderer) {
        renderer.domElement.removeEventListener("webglcontextlost", contextLost);
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      }
    };
  }, []);
  useEffect(() => {
    current.current.onReady(false);
    refresh.current?.();
  }, [props.source, props.crop]);
  return <div className="face-preview-wrap"><div className="face-preview" ref={host} />{error ? <p role="status">{error}</p> : <p className="face-hint">Xem trước · Kéo cừu để xem từ các phía</p>}</div>;
}
