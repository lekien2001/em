import { useEffect, useRef, useState } from "react";
import type { FaceAppearance } from "../types";
import { freeCanvas, type Crop } from "./image";
export type AppliedPhoto = {
  source: HTMLCanvasElement;
  crop: Crop;
  face: FaceAppearance;
};
export function usePersonalFace() {
  const [photo, setPhoto] = useState<AppliedPhoto | null>(null);
  const current = useRef(photo),
    serial = useRef(0);
  const [error, setError] = useState("");
  function clear(next?: HTMLCanvasElement) {
    const previous = current.current;
    if (previous?.source !== next) freeCanvas(previous?.source);
    freeCanvas(previous?.face.canvas);
  }
  function apply(source: HTMLCanvasElement, crop: Crop, canvas: HTMLCanvasElement) {
    clear(source);
    const next = {
      source,
      crop: {
        ...crop
      },
      face: {
        canvas,
        revision: ++serial.current
      }
    };
    current.current = next;
    setPhoto(next);
    setError("");
  }
  function restore() {
    clear();
    current.current = null;
    setPhoto(null);
    setError("");
  }
  useEffect(() => () => {
    clear();
    current.current = null;
  }, []);
  return {
    photo,
    apply,
    restore,
    error,
    setError
  };
}
