"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { FinanceModuleTabs } from "@/features/finance/components/FinanceModuleTabs";

/**
 * The six Finance V2 Phase 2 module pages (see FinanceModuleTabs) get the
 * horizontal module rail — but only on their own top-level list/overview
 * route, never on a deeper task page (`/finance/budgets/new`,
 * `/finance/budgets/[budgetId]`, a debt's payment form, ...), which stay
 * compact single-purpose subpages exactly as before.
 */
const MODULE_SECTIONS = new Set(["reports", "budgets", "installments", "debts", "goals", "net-worth"]);

const SECTION_TITLES: Record<string, string> = {
  "quick-add": "เพิ่มรายการ",
  transactions: "รายการทั้งหมด",
  tags: "แท็ก",
  budgets: "งบประมาณ",
  templates: "Template รายการ",
  recurring: "รายการประจำ",
  bills: "บิลและกำหนดจ่าย",
  installments: "แผนผ่อนชำระ",
  goals: "เป้าหมายการออม",
  debts: "หนี้และเงินยืม",
  reports: "รายงานการเงิน",
  "net-worth": "มูลค่าสุทธิ",
  insights: "ข้อมูลเชิงลึก",
  import: "นำเข้า CSV",
  export: "ส่งออก CSV",
};

export default function FinanceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/finance") return children;
  const section = pathname.split("/")[2] ?? "";
  const isModuleRoot = MODULE_SECTIONS.has(section) && pathname === `/finance/${section}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={SECTION_TITLES[section] ?? "การเงิน"} />
      {isModuleRoot ? (
        // finance-scope wraps the rail + the page's own content together
        // (never PageHeader itself, kept palette-neutral across every
        // finance subpage) — only these six module ROOT routes get it;
        // a deeper task page under the same section (new/edit/detail
        // forms) renders through the plain `else` branch below, unchanged.
        <div className="finance-scope -mx-4 flex flex-col gap-4 px-4 pb-4">
          <FinanceModuleTabs />
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
