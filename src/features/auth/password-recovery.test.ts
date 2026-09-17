import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://home.test" }),
}));
import { requestPasswordResetAction, resetPasswordAction } from "./actions";

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
beforeEach(() => {
  vi.resetAllMocks();
  auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  auth.updateUser.mockResolvedValue({ error: null });
  auth.getUser.mockResolvedValue({ data: { user: { id: "me" } } });
});
describe("password recovery", () => {
  it("uses the requesting app origin and PKCE callback", async () => {
    expect(
      await requestPasswordResetAction(
        {},
        form({ email: "user@example.test" }),
      ),
    ).toEqual({ success: true });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "user@example.test",
      {
        redirectTo: "https://home.test/auth/callback?next=/reset-password",
      },
    );
  });
  it("rejects an invalid email before requesting mail", async () => {
    expect(
      (await requestPasswordResetAction({}, form({ email: "invalid" }))).error,
    ).toBeTruthy();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it("requires matching strong passwords", async () => {
    expect(
      (
        await resetPasswordAction(
          {},
          form({ password: "password123", confirmPassword: "different" }),
        )
      ).error,
    ).toBeTruthy();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("rejects an expired recovery session", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    expect(
      (
        await resetPasswordAction(
          {},
          form({ password: "password123", confirmPassword: "password123" }),
        )
      ).error,
    ).toBeTruthy();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("updates only the authenticated user's password", async () => {
    expect(
      await resetPasswordAction(
        {},
        form({ password: "password123", confirmPassword: "password123" }),
      ),
    ).toEqual({ success: true });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "password123" });
  });
});
