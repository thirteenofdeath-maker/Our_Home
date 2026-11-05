import { describe, it, expect, vi } from "vitest";
import { readPages } from "./read-pages";
describe("complete paged reads", () => {
  it("keeps records beyond the API row cap", async () => {
    const rows = Array.from({ length: 1201 }, (_, id) => ({ id }));
    const load = vi.fn(async (from: number, to: number) => ({
      data: rows.slice(from, to + 1),
      error: null,
    }));
    expect(await readPages(load)).toEqual(rows);
    expect(load).toHaveBeenCalledTimes(3);
  });
  it("does not return a misleading partial list on page failure", async () => {
    await expect(
      readPages(
        async (from) => ({
          data: from === 0 ? [1, 2] : null,
          error: from === 0 ? null : new Error("offline"),
        }),
        2,
      ),
    ).rejects.toThrow("offline");
  });
});
