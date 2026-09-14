import { describe, expect, it } from "vitest";

import { createHousehold } from "./api";

describe("createHousehold", () => {
  it("inserts authenticated creator contract without requesting a RETURNING row", async () => {
    const creatorId = "11111111-1111-4111-8111-111111111111";
    let payload: unknown;
    let selectCalled = false;
    const supabase = {
      from(table: string) {
        expect(table).toBe("households");
        return {
          async insert(value: unknown) {
            payload = value;
            return { error: null };
          },
          select() {
            selectCalled = true;
          },
        };
      },
    };

    await createHousehold(supabase as never, { name: "Our Home", createdBy: creatorId });

    expect(payload).toEqual({ name: "Our Home", created_by: creatorId });
    expect(selectCalled).toBe(false);
  });
});
