import { prepareImageForUpload } from "@/lib/images/prepare-image-upload";

import { MAX_AVATAR_BYTES, MAX_AVATAR_SOURCE_BYTES } from "./profile";

export function prepareAvatarForUpload(file: File): Promise<File> {
  return prepareImageForUpload(file, {
    maxSourceBytes: MAX_AVATAR_SOURCE_BYTES,
    maxUploadBytes: MAX_AVATAR_BYTES,
    outputName: "avatar",
  });
}
