import { useEffect, useRef } from "react";
import { fitCrop, paintPhoto, PHOTO, type Crop } from "./image";
type Point = {
  x: number;
  y: number;
};
export function CropCanvas({
  source,
  crop,
  change
}: {
  source: HTMLCanvasElement;
  crop: Crop;
  change(crop: Crop): void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    current = useRef({
      source,
      crop,
      change
    });
  current.current = {
    source,
    crop,
    change
  };
  const pointers = useRef(new Map<number, Point>()),
    gesture = useRef<{
      crop: Crop;
      points: Point[];
    } | null>(null);
  const update = (next: Crop) => change(fitCrop(source, next).crop);
  const point = (clientX: number, clientY: number) => {
    const rect = canvas.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * PHOTO.width / rect.width,
      y: (clientY - rect.top) * PHOTO.height / rect.height
    };
  };
  function begin() {
    gesture.current = {
      crop: {
        ...current.current.crop
      },
      points: [...pointers.current.values()].map(p => ({
        ...p
      }))
    };
  }
  useEffect(() => {
    const element = canvas.current!,
      context = element.getContext("2d")!;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.floor(300 * dpr);
    const height = Math.floor(400 * dpr);
    if (element.width !== width) element.width = width;
    if (element.height !== height) element.height = height;
    paintPhoto(context, source, crop, element.width, element.height);
    context.save();
    context.scale(element.width / PHOTO.width, element.height / PHOTO.height);
    context.fillStyle = "rgba(9,20,29,.74)";
    context.beginPath();
    context.rect(0, 0, PHOTO.width, PHOTO.height);
    context.ellipse(PHOTO.width / 2, PHOTO.height / 2, PHOTO.width / 2 - 2, PHOTO.height / 2 - 2, 0, 0, Math.PI * 2);
    context.fill("evenodd");
    context.strokeStyle = "#d9c9ef";
    context.lineWidth = 4;
    context.stroke();
    context.restore();
  }, [source, crop]);
  useEffect(() => {
    const el = canvas.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const {
        source,
        crop,
        change
      } = current.current;
      change(fitCrop(source, {
        ...crop,
        zoom: crop.zoom * Math.exp(-event.deltaY * .0015)
      }).crop);
    };
    el.addEventListener("wheel", wheel, {
      passive: false
    });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  return <canvas ref={canvas} className="face-crop" tabIndex={0} role="img" aria-label="Căn khuôn mặt trong khung bầu dục. Kéo để di chuyển; phím mũi tên để căn ảnh." onPointerDown={e => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, point(e.clientX, e.clientY));
    begin();
  }} onPointerMove={e => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    e.preventDefault();
    e.stopPropagation();
    pointers.current.set(e.pointerId, point(e.clientX, e.clientY));
    const now = [...pointers.current.values()],
      start = gesture.current.points,
      base = gesture.current.crop;
    if (now.length === 1 && start.length === 1) update({
      ...base,
      x: base.x + now[0].x - start[0].x,
      y: base.y + now[0].y - start[0].y
    });
    if (now.length >= 2 && start.length >= 2) {
      const distance = (p: Point[]) => Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
      const angle = (p: Point[]) => Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
      let rotation = base.rotation + (angle(now) - angle(start)) * 180 / Math.PI;
      rotation = (rotation + 540) % 360 - 180;
      update({
        ...base,
        zoom: base.zoom * distance(now) / Math.max(1, distance(start)),
        rotation,
        x: base.x + (now[0].x + now[1].x - start[0].x - start[1].x) / 2,
        y: base.y + (now[0].y + now[1].y - start[0].y - start[1].y) / 2
      });
    }
  }} onPointerUp={e => {
    pointers.current.delete(e.pointerId);
    begin();
  }} onPointerCancel={e => {
    pointers.current.delete(e.pointerId);
    begin();
  }} onLostPointerCapture={e => {
    pointers.current.delete(e.pointerId);
    begin();
  }} onKeyDown={e => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    e.stopPropagation();
    const step = e.shiftKey ? 10 : 1;
    update({
      ...crop,
      x: crop.x + move[0] * step,
      y: crop.y + move[1] * step
    });
  }} />;
}
