/** Browser-only photo processing. No uploads, persistence or face detection. */
export type Crop = {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
};
export const PHOTO = {
  width: 768,
  height: 1024,
  feather: 8,
  maxBytes: 20 * 1024 * 1024,
  maxPixels: 50_000_000,
  sourceEdge: 3072
} as const;
export const initialCrop = (): Crop => ({
  x: 0,
  y: 0,
  zoom: 1,
  rotation: 0
});
export async function readPhoto(file: File): Promise<HTMLCanvasElement> {
  if (!file.size || file.size > PHOTO.maxBytes) throw new Error("Hãy chọn ảnh không quá 20 MB.");
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes[0] === 137 && String.fromCharCode(...bytes.slice(1, 4)) === "PNG";
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!jpeg && !png && !webp) throw new Error("Hãy chọn ảnh JPEG, PNG hoặc WebP. Với ảnh HEIC, hãy chuyển sang JPEG trước.");
  let source: ImageBitmap | HTMLImageElement | undefined;
  let url: string | undefined;
  try {
    try {
      source = await createImageBitmap(file, {
        imageOrientation: "from-image"
      });
    } catch {
      // HTMLImageElement also applies EXIF orientation. Do not apply it twice.
      url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      await image.decode();
      source = image;
    }
    const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    if (!width || !height) throw new Error("Không đọc được kích thước ảnh.");
    if (width * height > PHOTO.maxPixels) throw new Error("Ảnh quá lớn. Hãy chọn ảnh không quá 50 megapixel.");
    const scale = Math.min(1, PHOTO.sourceEdge / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
    // Opaque photographs avoid holes through the head when uploading an alpha PNG.
    context.fillStyle = "#e5dfd3";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  } catch (error) {
    if (error instanceof Error && /megapixel|kích thước|hỗ trợ/.test(error.message)) throw error;
    throw new Error("Không đọc được ảnh này. Hãy thử ảnh JPEG, PNG hoặc WebP khác.");
  } finally {
    if (source && "close" in source) source.close();
    if (url) URL.revokeObjectURL(url);
  }
}

/** Translation is in export pixels; one uniform scale preserves facial proportions.
 * Ellipse support along the rotated source axes prevents uncovered crop edges. */
export function fitCrop(source: {
  width: number;
  height: number;
}, crop: Crop) {
  const angle = crop.rotation * Math.PI / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const ex = Math.hypot(PHOTO.width / 2 * c, PHOTO.height / 2 * s);
  const ey = Math.hypot(PHOTO.width / 2 * s, PHOTO.height / 2 * c);
  const scale = Math.max(2 * ex / source.width, 2 * ey / source.height) * Math.max(1, Math.min(8, crop.zoom));
  const dx = Math.max(0, source.width * scale / 2 - ex),
    dy = Math.max(0, source.height * scale / 2 - ey);
  const x = Math.max(-dx, Math.min(dx, c * crop.x + s * crop.y));
  const y = Math.max(-dy, Math.min(dy, -s * crop.x + c * crop.y));
  return {
    crop: {
      ...crop,
      zoom: Math.max(1, Math.min(8, crop.zoom)),
      x: c * x - s * y,
      y: s * x + c * y
    },
    scale
  };
}
export function paintPhoto(context: CanvasRenderingContext2D, source: HTMLCanvasElement, crop: Crop, width: number = PHOTO.width, height: number = PHOTO.height) {
  const fitted = fitCrop(source, crop);
  context.save();
  context.clearRect(0, 0, width, height);
  context.scale(width / PHOTO.width, height / PHOTO.height);
  context.translate(PHOTO.width / 2 + fitted.crop.x, PHOTO.height / 2 + fitted.crop.y);
  context.rotate(crop.rotation * Math.PI / 180);
  context.scale(fitted.scale, fitted.scale);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  context.restore();
}
export const PREVIEW_PHOTO = { width: 384, height: 512 } as const;

type PhotoSize = "preview" | "full";
// Two shared masks contain only the reusable ellipse, never user pixels.
const masks = new Map<PhotoSize, HTMLCanvasElement>();

function faceMask(size: PhotoSize) {
  const cached = masks.get(size);
  if (cached) return cached;

  const { width, height } = size === "preview" ? PREVIEW_PHOTO : PHOTO;
  const mask = document.createElement("canvas");
  mask.width = width;
  mask.height = height;
  const context = mask.getContext("2d");
  if (!context) throw new Error("Không thể tạo mặt nạ ảnh.");
  const image = context.createImageData(width, height);
  const innerRadius = 1 - 2 * PHOTO.feather / PHOTO.width;
  const innerRadiusSquared = innerRadius * innerRadius;
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5 - height / 2) / (height / 2);
    const vSquared = v * v;
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5 - width / 2) / (width / 2);
      const radiusSquared = u * u + vSquared;
      if (radiusSquared >= 1) continue;
      // Only alpha matters for destination-in.
      const alpha = (y * width + x) * 4 + 3;
      if (radiusSquared <= innerRadiusSquared) {
        image.data[alpha] = 255;
      } else {
        const t = (1 - Math.sqrt(radiusSquared)) / (1 - innerRadius);
        image.data[alpha] = Math.round(255 * t * t * (3 - 2 * t));
      }
    }
  }
  context.putImageData(image, 0, 0);
  masks.set(size, mask);
  return mask;
}

export function createFaceSurface(size: PhotoSize) {
  const mask = faceMask(size);
  const canvas = document.createElement("canvas");
  canvas.width = mask.width;
  canvas.height = mask.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Không thể tạo ảnh mặt. Hãy thử lại.");
  return {
    canvas,
    clear() {
      context.clearRect(0, 0, canvas.width, canvas.height);
    },
    paint(source: HTMLCanvasElement, crop: Crop) {
      paintPhoto(context, source, crop, canvas.width, canvas.height);
      context.save();
      context.globalCompositeOperation = "destination-in";
      context.drawImage(mask, 0, 0);
      context.restore();
    },
  };
}

export function exportFace(source: HTMLCanvasElement, crop: Crop): HTMLCanvasElement {
  const surface = createFaceSurface("full");
  surface.paint(source, crop);
  return surface.canvas;
}
export function freeCanvas(canvas?: HTMLCanvasElement | null) {
  if (canvas) canvas.width = canvas.height = 0;
}
