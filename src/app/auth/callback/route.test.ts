import { beforeEach, describe, expect, it, vi } from "vitest";
const exchange = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { exchangeCodeForSession: exchange } }) }));
import { GET } from "./route";
beforeEach(() => { exchange.mockReset(); exchange.mockResolvedValue({ error: null }); });
describe("email callback routing", () => {
  it("allows recovery only at the app's own reset page", async () => {
    const result = await GET(new Request("https://home.test/auth/callback?code=valid&next=/reset-password"));
    expect(result.headers.get("location")).toBe("https://home.test/reset-password");
  });
  it("does not accept a caller-provided external redirect", async () => {
    const result = await GET(new Request("https://home.test/auth/callback?code=valid&next=//evil.test"));
    expect(result.headers.get("location")).toBe("https://home.test/");
  });
  it("keeps expired account-confirmation and recovery errors separate", async () => {
    exchange.mockResolvedValue({ error: new Error("expired") });
    const login = await GET(new Request("https://home.test/auth/callback?code=bad"));
    const reset = await GET(new Request("https://home.test/auth/callback?code=bad&next=/reset-password"));
    expect(login.headers.get("location")).toBe("https://home.test/login?authError=1");
    expect(reset.headers.get("location")).toBe("https://home.test/forgot-password?expired=1");
  });
});
