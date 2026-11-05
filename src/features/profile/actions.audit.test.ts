import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  current: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/lib/auth/require-user", () => ({
  requireUser: async () => ({
    supabase: {},
    user: { id: "11111111-1111-4111-8111-111111111111" },
  }),
}));
vi.mock("./api", () => ({
  uploadAvatar: mocks.upload,
  updateProfileDetails: mocks.update,
  deleteAvatar: mocks.remove,
  getCurrentProfile: mocks.current,
}));
vi.mock("@/lib/supabase/log-error", () => ({ logDatabaseErrorInDev: vi.fn() }));
import { updateProfileAction } from "./actions";
function form() {
  const f = new FormData();
  for (const [key, value] of Object.entries({
    householdId: "22222222-2222-4222-8222-222222222222",
    displayName: "Test",
    gender: "",
    birthday: "",
    memberColor: "#123456",
  }))
    f.set(key, value);
  f.set("avatar", new File(["new photo"], "photo.jpg", { type: "image/jpeg" }));
  return f;
}
describe("failed avatar save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.current.mockResolvedValue({
      avatar_url: "11111111-1111-4111-8111-111111111111/avatar.jpg",
    });
    mocks.upload.mockResolvedValue(undefined);
    mocks.update.mockResolvedValue(undefined);
  });
  it("removes only the new version after a database failure", async () => {
    mocks.update.mockRejectedValueOnce(new Error("database offline"));
    const state = await updateProfileAction({}, form());
    expect(state.error).toBeTruthy();
    const path = mocks.upload.mock.calls[0][1];
    expect(path).toMatch(/\/avatar-[0-9a-f-]{36}\.jpg$/);
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({}, path);
  });
  it("preserves the previous image when upload fails", async () => {
    mocks.upload.mockRejectedValueOnce(new Error("storage offline"));
    expect((await updateProfileAction({}, form())).error).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("rejects a non-existent birthday before uploading", async () => {
    const f = form();
    f.set("birthday", "2026-02-30");
    expect((await updateProfileAction({}, f)).error).toBeTruthy();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
