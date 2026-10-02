import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_PET_PHOTO_BYTES } from "./pet";
import { preparePetPhotoForUpload } from "./photo-compression";

afterEach(() => vi.unstubAllGlobals());

describe("pet photo preparation", () => {
  it("leaves an already-small supported image unchanged", async () => {
    const file = new File([new Uint8Array(128)], "small.jpg", {
      type: "image/jpeg",
    });
    await expect(preparePetPhotoForUpload(file)).resolves.toBe(file);
  });

  it("compresses a large camera image before it reaches the server action", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 4032, height: 3024, close }),
    );
    const drawImage = vi.fn();
    const toBlob = vi.fn(
      (callback: (blob: Blob | null) => void) =>
        callback(new Blob([new Uint8Array(1024)], { type: "image/jpeg" })),
    );
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ clearRect: vi.fn(), drawImage }),
        toBlob,
      }),
    });
    const file = new File(
      [new Uint8Array(MAX_PET_PHOTO_BYTES + 1)],
      "camera.png",
      { type: "image/png" },
    );

    const prepared = await preparePetPhotoForUpload(file);

    expect(prepared.type).toBe("image/jpeg");
    expect(prepared.name).toBe("camera.jpg");
    expect(prepared.size).toBeLessThanOrEqual(MAX_PET_PHOTO_BYTES);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("converts an iPhone HEIC image to an uploadable JPEG", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 1170, height: 2532, close }),
    );
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ clearRect: vi.fn(), drawImage: vi.fn() }),
        toBlob: (callback: (blob: Blob | null) => void) =>
          callback(new Blob([new Uint8Array(1024)], { type: "image/jpeg" })),
      }),
    });
    const file = new File([new Uint8Array(2048)], "IMG_1234.HEIC", {
      type: "image/heic",
    });

    const prepared = await preparePetPhotoForUpload(file);

    expect(prepared.name).toBe("IMG_1234.jpg");
    expect(prepared.type).toBe("image/jpeg");
    expect(prepared.size).toBeLessThanOrEqual(MAX_PET_PHOTO_BYTES);
    expect(close).toHaveBeenCalledOnce();
  });
});
