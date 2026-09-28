import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("wide dashboard cover and action layout", () => {
  const primaryPages = [
    "src/app/(app)/calendar/page.tsx",
    "src/app/(app)/pets/page.tsx",
    "src/app/(app)/household/page.tsx",
  ];

  it("uses the same 7/5 landscape cover proportion as the home dashboard", () => {
    for (const path of primaryPages) {
      const source = read(path);
      expect(source, path).toContain("lg:landscape:col-span-7");
      expect(source, path).toContain("lg:landscape:col-span-5");
      expect(source, path).not.toContain("lg:landscape:h-[28rem]");
      expect(source, path).not.toContain("lg:landscape:sticky");
    }
  });

  it("turns primary desktop FABs into aligned labeled actions", () => {
    const files = [
      "src/features/finance/components/FinanceCreateFlow.tsx",
      "src/features/calendar/components/AddCalendarEventFab.tsx",
      "src/features/pets/components/AddPetFab.tsx",
      "src/app/(app)/household/page.tsx",
    ];

    for (const path of files) {
      const source = read(path);
      expect(source, path).toContain("desktop-dashboard-fab");
      expect(source, path).toContain("lg:landscape:inline");
    }

    expect(read("src/app/globals.css")).toContain(".desktop-dashboard-fab");
  });
});
