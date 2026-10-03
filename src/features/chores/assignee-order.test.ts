import { describe, expect, it } from "vitest";

import {
  initialAssigneeOrder,
  moveAssignee,
  toggleAssignee,
} from "./assignee-order";

const members = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("chore assignee order", () => {
  it("selects every member for a new rotation", () => {
    expect(initialAssigneeOrder(members)).toEqual(["a", "b", "c"]);
  });

  it("preserves the stored order and removes unknown members", () => {
    expect(initialAssigneeOrder(members, ["c", "missing", "a", "c"])).toEqual([
      "c",
      "a",
    ]);
  });

  it("moves an assignee one position without mutating the current order", () => {
    const current = ["a", "b", "c"];
    expect(moveAssignee(current, "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveAssignee(current, "b", 1)).toEqual(["a", "c", "b"]);
    expect(current).toEqual(["a", "b", "c"]);
  });

  it("keeps boundary moves unchanged", () => {
    const current = ["a", "b", "c"];
    expect(moveAssignee(current, "a", -1)).toBe(current);
    expect(moveAssignee(current, "c", 1)).toBe(current);
  });

  it("removes an assignee and appends them when selected again", () => {
    expect(toggleAssignee(["a", "b", "c"], "b", false)).toEqual(["a", "c"]);
    expect(toggleAssignee(["a", "c"], "b", true)).toEqual(["a", "c", "b"]);
  });
});
