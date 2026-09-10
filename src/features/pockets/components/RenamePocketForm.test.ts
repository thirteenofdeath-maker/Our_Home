import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PocketRenameEditor, RenamePocketForm } from "./RenamePocketForm";

describe("RenamePocketForm", () => {
  it("renders an enabled semantic trigger with a practical touch target", () => {
    const html = renderToStaticMarkup(
      createElement(RenamePocketForm, { pocketId: "pocket-1", walletId: "wallet-1", currentName: "อาหาร" }),
    );
    expect(html).toMatch(/<button[^>]*type="button"/);
    expect(html).toContain("แก้ไขชื่อ");
    expect(html).toContain("h-11");
    expect(html).not.toMatch(/\sdisabled(?:=|\s|>)/);
    expect(html).toContain('aria-expanded="false"');
  });

  it("renders the edit input with current name plus Save and Cancel controls", () => {
    const html = renderToStaticMarkup(
      createElement(PocketRenameEditor, {
        pocketId: "pocket-1",
        walletId: "wallet-1",
        currentName: "อาหาร",
        formAction: vi.fn(),
        onCancel: vi.fn(),
      }),
    );
    expect(html).toContain('name="name"');
    expect(html).toContain('value="อาหาร"');
    expect(html).toContain("บันทึก");
    expect(html).toContain("ยกเลิก");
    expect(html.match(/h-11/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("wires click-to-edit and Cancel-to-closed state without nested forms", () => {
    const component = readFileSync(resolve(process.cwd(), "src/features/pockets/components/RenamePocketForm.tsx"), "utf8");
    const manager = readFileSync(resolve(process.cwd(), "src/features/pockets/components/PocketManagerList.tsx"), "utf8");
    expect(component).toContain("onClick={() => setEditing(true)}");
    expect(component).toContain("onCancel={() => setEditing(false)}");
    expect(manager).not.toMatch(/<form[^>]*>[\s\S]*<RenamePocketForm/);
  });
});
