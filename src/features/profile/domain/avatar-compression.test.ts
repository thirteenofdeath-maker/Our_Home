import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareAvatarForUpload } from "./avatar-compression";

afterEach(() => vi.unstubAllGlobals());

describe("avatar preparation", () => {
  it("keeps a small upload-compatible photo unchanged", async () => {
    const file = new File([new Uint8Array(128)], "avatar.jpg", {
      type: "image/jpeg",
    });

    await expect(prepareAvatarForUpload(file)).resolves.toBe(file);
  });

  it("normalizes a mobile photo with no MIME type from its extension", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 3024, height: 4032, close }),
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
    const file = new File([new Uint8Array(2048)], "camera.HEIC", {
      type: "",
    });

    const prepared = await prepareAvatarForUpload(file);

    expect(prepared.name).toBe("camera.jpg");
    expect(prepared.type).toBe("image/jpeg");
    expect(close).toHaveBeenCalledOnce();
  });
});
