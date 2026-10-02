const DIRECT_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MOBILE_SOURCE_MIME_TYPES = new Set([
  ...DIRECT_UPLOAD_MIME_TYPES,
  "image/jpg",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const MOBILE_SOURCE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
]);

const MAX_DIMENSION = 1920;
const JPEG_QUALITIES = [0.86, 0.76, 0.66, 0.56] as const;

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

function extension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function isSupportedMobileSource(file: File): boolean {
  const mimeType = file.type.toLowerCase();
  return (
    MOBILE_SOURCE_MIME_TYPES.has(mimeType) ||
    ((!mimeType || mimeType === "application/octet-stream") &&
      MOBILE_SOURCE_EXTENSIONS.has(extension(file.name)))
  );
}

async function decodeWithImageElement(file: File): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  const image = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("decode failed"));
      image.src = url;
    });
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }

  return {
    source: image,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    dispose: () => URL.revokeObjectURL(url),
  };
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Mobile Safari can expose createImageBitmap while failing to decode a
      // camera format that HTMLImageElement can still display.
    }
  }

  return decodeWithImageElement(file);
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("ไม่สามารถย่อรูปได้")),
      "image/jpeg",
      quality,
    );
  });
}

export type PrepareImageUploadOptions = {
  maxSourceBytes: number;
  maxUploadBytes: number;
  outputName: string;
};

/**
 * Normalizes mobile camera images before a Server Action. HEIC/HEIF and files
 * without a MIME type are converted to JPEG, while large JPEG/PNG/WebP images
 * are resized below the platform request-body ceiling.
 */
export async function prepareImageForUpload(
  file: File,
  options: PrepareImageUploadOptions,
): Promise<File> {
  if (!isSupportedMobileSource(file)) {
    throw new Error("รองรับรูป JPEG, PNG, WebP, HEIC หรือ HEIF");
  }
  if (file.size > options.maxSourceBytes) {
    throw new Error("รูปต้นฉบับต้องมีขนาดไม่เกิน 15 MB");
  }

  if (
    DIRECT_UPLOAD_MIME_TYPES.has(file.type.toLowerCase()) &&
    file.size <= options.maxUploadBytes
  ) {
    return file;
  }

  let image: DecodedImage;
  try {
    image = await decodeImage(file);
  } catch {
    throw new Error(
      "มือถือไม่สามารถอ่านรูปนี้ได้ กรุณาเลือกรูป JPEG, PNG หรือ WebP",
    );
  }

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
      context.drawImage(image.source, 0, 0, width, height);
      latest = await canvasBlob(canvas, quality);
      if (latest.size <= options.maxUploadBytes) break;
      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }

    if (!latest || latest.size > options.maxUploadBytes) {
      throw new Error("รูปยังมีขนาดใหญ่เกินไป กรุณาเลือกรูปอื่น");
    }

    const stem =
      file.name.replace(/\.[^.]+$/, "") || options.outputName || "photo";
    return new File([latest], `${stem}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    image.dispose();
  }
}
