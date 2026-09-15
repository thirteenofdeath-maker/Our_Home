import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("pet care record sheet success lifecycle", () => {
  it("returns an explicit success state only after the write and revalidation", () => {
    const actions = read("src/features/pets/actions.ts");
    const successIndex = actions.indexOf("return { success: true }");
    expect(successIndex).toBeGreaterThan(actions.indexOf("createPetCareRecord(supabase"));
    expect(successIndex).toBeGreaterThan(actions.indexOf('revalidatePath(`/pets/${pet.id}`)'));
  });

  it("closes the owning sheet on success but keeps errors visible", () => {
    const form = read("src/features/pets/components/PetCareRecordForm.tsx");
    expect(form).toContain("useCloseFormSheet()");
    expect(form).toMatch(/if \(state\.success\) closeSheet\?\.\(\)/);
    expect(form).toContain("state.error ?");
  });

  it("remounts the form after close so reopening starts with clean action state", () => {
    const sheet = read("src/components/ui/FormSheetButton.tsx");
    expect(sheet).toContain("setFormKey((current) => current + 1)");
    expect(sheet).toContain("key={formKey}");
  });
});
