import { describe, expect, it } from "vitest";

import {
  avatarPath,
  initials,
  MAX_AVATAR_BYTES,
  validateAvatarFile,
} from "./profile";

describe("profile avatar rules", () => {
  it("builds an authenticated-user-scoped deterministic path", () => {
    expect(avatarPath("user-uuid", "image/webp")).toBe("user-uuid/avatar.webp");
  });

  it.each(["image/jpeg", "image/png", "image/webp"] as const)("accepts %s", (type) => {
    expect(validateAvatarFile({ type, size: MAX_AVATAR_BYTES })).toBeNull();
  });

  it("rejects unsupported MIME types", () => {
    expect(validateAvatarFile({ type: "image/gif", size: 100 })).toMatch(/JPEG/);
  });

  it("rejects files over 15 MB", () => {
    expect(MAX_AVATAR_BYTES).toBe(15 * 1024 * 1024);
    expect(validateAvatarFile({ type: "image/png", size: MAX_AVATAR_BYTES + 1 })).toMatch(/15 MB/);
  });
});

describe("profile initials fallback", () => {
  it("uses at most two name parts", () => {
    expect(initials("  Jane Mary Doe ")).toBe("JM");
  });

  it("has a safe fallback for an empty name", () => {
    expect(initials("   ")).toBe("?");
  });
});
