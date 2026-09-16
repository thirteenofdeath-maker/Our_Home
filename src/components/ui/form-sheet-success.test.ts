import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("bottom-sheet success lifecycle audit", () => {
  it("has one shared close-on-success hook and both sheet primitives provide its context", () => {
    const sync = read("src/components/ui/FormSheetButton.tsx");
    const asyncSheet = read("src/components/ui/AsyncFormSheetButton.tsx");
    expect(sync).toContain("useCloseFormSheetOnSuccess");
    expect(sync).toMatch(/if \(success\) closeSheet\?\.\(\)/);
    expect(sync).toContain("<FormSheetCloseProvider");
    expect(asyncSheet).toContain("<FormSheetCloseProvider onClose={handleClose}>");
  });

  it.each([
    ["src/features/household/components/AddMemberForm.tsx", "src/features/household/actions.ts"],
    ["src/features/plan/components/ReminderForm.tsx", "src/features/plan/actions.ts"],
    ["src/features/pets/components/PetCareRecordForm.tsx", "src/features/pets/actions.ts"],
  ])("%s closes only after its action explicitly reports success", (formPath, actionPath) => {
    const form = read(formPath);
    const action = read(actionPath);
    expect(form).toContain("useCloseFormSheetOnSuccess(state.success)");
    expect(form).toContain("state.error ?");
    expect(action).toContain("return { success: true }");
  });

  it("keeps full-page Pocket creation navigation while sheet creation closes in place", () => {
    const form = read("src/features/pockets/components/AddPocketForm.tsx");
    const action = read("src/features/pockets/actions.ts");
    expect(form).toContain("useCloseFormSheetOnSuccess(state.success)");
    expect(form).toContain('name="formMode" value="sheet"');
    expect(action).toContain('formData.get("formMode") === "sheet"');
    expect(action).toMatch(/formMode[\s\S]*?return \{ success: true \}[\s\S]*?redirect\(`/);
  });
});
