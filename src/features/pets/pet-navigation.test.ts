import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(
  resolve(process.cwd(), "src/features/pets/actions.ts"),
  "utf8",
);

describe("pet form navigation", () => {
  it("returns to the pet overview with the saved pet selected", () => {
    expect(actions).toContain("redirect(`/pets?pet=${id}`)");
    expect(actions).toContain("redirect(`/pets?pet=${petId}`)");
  });
});
