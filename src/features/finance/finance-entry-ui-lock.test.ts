import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe,expect,it } from "vitest";
const read=(path:string)=>readFileSync(resolve(process.cwd(),path),"utf8");
describe("locked Finance entry UI",()=>{
  it("does not mount a global Finance FAB",()=>{
    expect(read("src/components/shared/AppShell.tsx")).not.toContain("financeQuickAdd");
    expect(read("src/app/(app)/layout.tsx")).not.toContain("GlobalQuickAdd");
  });
  it("uses labeled in-page actions for Finance resources",()=>{
    for(const path of ["budgets","installments","debts","goals"]){
      const source=read(`src/app/(app)/finance/${path}/page.tsx`);
      expect(source).toContain("asEmptyStateCta");
    }
    expect(read("src/app/(app)/wallets/page.tsx")).toContain("เพิ่ม Wallet");
    expect(read("src/app/(app)/finance/cards/page.tsx")).toContain("เพิ่มบัตร");
  });
  it("uses the locked warm Finance palette",()=>{
    const css=read("src/app/globals.css");
    expect(css).toContain("--finance-background: #fbf7ef");
    expect(css).toContain("--finance-text: #4b4038");
    expect(css).toContain("--finance-primary: #7c9a83");
  });
});
