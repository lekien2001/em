import { useEffect, useRef, useState } from "react";
import { sourceAssets } from "../assets/catalog";
import type { SceneProps } from "../types";
import { createSceneRenderer, type SceneHandle } from "./SceneRenderer";
/** React owns the host and renderer lifetime; the renderer reads current props. */
export function SceneView(props: SceneProps) {
  const host = useRef<HTMLDivElement>(null),
    current = useRef(props),
    renderer = useRef<SceneHandle | undefined>(undefined);
  current.current = props;
  const [fallback, setFallback] = useState(false),
    [ready, setReady] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const instance = createSceneRenderer(
      host.current,
      () => current.current,
      setFallback,
      setReady,
    );
    renderer.current = instance;
    return () => {
      instance?.dispose();
      renderer.current = undefined;
    };
  }, []);
  useEffect(
    () => renderer.current?.sync(),
    [props.playing, props.reduced, props.speed, props.editorOpen],
  );
  useEffect(() => renderer.current?.home(), [props.reset]);
  useEffect(() => renderer.current?.setFace(props.face ?? null), [props.face]);
  useEffect(() => {
    if (props.sessionId) renderer.current?.reset();
  }, [props.sessionId]);
  return (
    <div
      className={`world ${fallback ? "world-fallback" : ""} ${ready ? "world-ready" : ""}`}
      data-scene-kind="rigged-asset-3d"
    >
      <img
        className="scene-poster"
        src={sourceAssets.landscape.url}
        alt=""
        aria-hidden="true"
      />
      <div ref={host} className="canvas-host" />
      {(!ready || fallback) && (
        <p className="scene-status" role="status">
          {fallback
            ? "Đang hiển thị cảnh tĩnh. Bạn vẫn có thể nghe âm thanh thư giãn."
            : "Một khoảng bình yên đang đến…"}
        </p>
      )}
    </div>
  );
}
