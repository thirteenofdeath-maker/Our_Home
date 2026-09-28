import {
  MAX_PET_PHOTO_BYTES,
  validatePetPhotoSource,
} from "./pet";

const MAX_DIMENSION = 1920;
const JPEG_QUALITIES = [0.86, 0.76, 0.66, 0.56] as const;

type DecodedImage = CanvasImageSource & {
  width: number;
  height: number;
  close?: () => void;
};

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("ไม่สามารถย่อรูปได้")),
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Shrinks large camera photos before they enter a Server Action. This keeps
 * the multipart request below Vercel's fixed function payload ceiling while
 * retaining enough resolution for profile cards and full-screen pet pages.
 */
export async function preparePetPhotoForUpload(file: File): Promise<File> {
  const validationError = validatePetPhotoSource(file);
  if (validationError) throw new Error(validationError);
  if (file.size <= MAX_PET_PHOTO_BYTES) return file;

  const image = await decodeImage(file);
  try {
    const initialScale = Math.min(
      1,
      MAX_DIMENSION / Math.max(image.width, image.height),
    );
    let width = Math.max(1, Math.round(image.width * initialScale));
    let height = Math.max(1, Math.round(image.height * initialScale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("อุปกรณ์นี้ไม่สามารถย่อรูปได้");

    let latest: Blob | null = null;
    for (const quality of JPEG_QUALITIES) {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      latest = await canvasBlob(canvas, quality);
      if (latest.size <= MAX_PET_PHOTO_BYTES) break;
      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }

    if (!latest || latest.size > MAX_PET_PHOTO_BYTES) {
      throw new Error("รูปยังมีขนาดใหญ่เกินไป กรุณาเลือกรูปอื่น");
    }
    const stem = file.name.replace(/\.[^.]+$/, "") || "pet-photo";
    return new File([latest], `${stem}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    image.close?.();
  }
}
