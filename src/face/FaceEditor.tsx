import { useEffect, useRef, useState } from "react";
import { Dialog } from "../ui/Dialog";
import { CropCanvas } from "./CropCanvas";
import { FacePreview } from "./FacePreview";
import { exportFace, fitCrop, freeCanvas, initialCrop, readPhoto, type Crop } from "./image";
import type { usePersonalFace } from "./usePersonalFace";
export function FaceEditor({
  face,
  close,
  sceneReady
}: {
  face: ReturnType<typeof usePersonalFace>;
  close(): void;
  sceneReady: boolean;
}) {
  const [source, setSource] = useState<HTMLCanvasElement | null>(face.photo?.source ?? null),
    [crop, setCrop] = useState<Crop>(face.photo?.crop ?? initialCrop());
  const [loading, setLoading] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null),
    owned = useRef<HTMLCanvasElement | null>(null),
    serial = useRef(0),
    mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      serial.current++;
      freeCanvas(owned.current);
      owned.current = null;
    };
  }, []);
  async function choose(file?: File) {
    if (!file) return;
    const request = ++serial.current;
    setLoading(true);
    setError("");
    try {
      const next = await readPhoto(file);
      if (!mounted.current || request !== serial.current) {
        freeCanvas(next);
        return;
      }
      freeCanvas(owned.current);
      owned.current = next;
      setSource(next);
      setCrop(initialCrop());
    } catch (error) {
      if (mounted.current && request === serial.current) setError(error instanceof Error ? error.message : "Không đọc được ảnh.");
    } finally {
      if (mounted.current && request === serial.current) setLoading(false);
    }
  }
  function change(next: Crop) {
    if (source) setCrop(fitCrop(source, next).crop);
  }
  function apply() {
    if (!source || loading || !ready || !sceneReady) return;
    try {
      const start = performance.now();
      const output = exportFace(source, crop);
      if (new URLSearchParams(location.search).get("qa") === "1") {
        performance.measure("em:face-apply-crop", { start });
      }
      face.apply(source, crop, output);
      owned.current = null;
      close();
    } catch {
      setError("Không thể tạo ảnh mặt. Hãy thử lại.");
    }
  }
  return <Dialog title="Mặt cừu của bạn" close={close} compact className="face-dialog" backdropClassName="face-editor-backdrop">
    <p className="face-description">Căn mặt thật vào khung bầu dục. Ảnh chỉ ở trên thiết bị và sẽ mất khi tải lại trang.</p>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Chọn ảnh khuôn mặt" hidden onChange={event => {
      void choose(event.target.files?.[0]);
      event.target.value = "";
    }} />
    <div className="face-editor-grid">
      <div className="face-edit-column">
        {source ? <CropCanvas source={source} crop={crop} change={change} /> : <div className="face-empty"><span aria-hidden="true">☺</span><p>Một chiếc mặt quen,<br />trong bộ đồ cừu mềm.</p><button onClick={() => input.current?.click()}>Chọn ảnh</button></div>}
        {source && <>
          <p className="face-hint">Kéo để căn · Cuộn hoặc chụm hai ngón để phóng</p>
          <label className="face-range">Phóng to <input type="range" aria-label="Phóng to ảnh" min="1" max="8" step="0.01" value={crop.zoom} onChange={e => change({
              ...crop,
              zoom: +e.target.value
            })} /><output>{Math.round(crop.zoom * 100)}%</output></label>
          <label className="face-range">Xoay <input type="range" aria-label="Xoay ảnh" min="-180" max="180" step="1" value={crop.rotation} onChange={e => change({
              ...crop,
              rotation: +e.target.value
            })} /><output>{Math.round(crop.rotation)}°</output></label>
        </>}
      </div>
      <FacePreview source={source} crop={crop} onReady={setReady} />
    </div>
    {loading && <p role="status" className="face-hint">Đang đọc ảnh…</p>}
    {error && <p role="alert" className="face-error">{error}</p>}
    {!sceneReady && <p role="status" className="face-error">Cảnh 3D chưa sẵn sàng để áp dụng ảnh.</p>}
    <div className="face-actions">
      {source && <button disabled={loading} onClick={() => input.current?.click()}>Chọn ảnh</button>}
      {source && <button disabled={loading} onClick={() => setCrop(initialCrop())}>Chỉnh lại</button>}
      <button disabled={!face.photo && !source} onClick={() => {
        serial.current++;
        setLoading(false);
        face.restore();
        freeCanvas(owned.current);
        owned.current = null;
        setSource(null);
        setCrop(initialCrop());
        setError("");
      }}>Khôi phục</button>
      <button className="face-apply" disabled={!source || loading || !ready || !sceneReady} onClick={apply}>Áp dụng</button>
    </div>
  </Dialog>;
}
