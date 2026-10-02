import { prepareImageForUpload } from "@/lib/images/prepare-image-upload";

import { MAX_PET_PHOTO_BYTES, MAX_PET_PHOTO_SOURCE_BYTES } from "./pet";

/**
 * Shrinks large camera photos before they enter a Server Action. This keeps
 * the multipart request below Vercel's fixed function payload ceiling while
 * retaining enough resolution for profile cards and full-screen pet pages.
 */
export async function preparePetPhotoForUpload(file: File): Promise<File> {
  return prepareImageForUpload(file, {
    maxSourceBytes: MAX_PET_PHOTO_SOURCE_BYTES,
    maxUploadBytes: MAX_PET_PHOTO_BYTES,
    outputName: "pet-photo",
  });
}
