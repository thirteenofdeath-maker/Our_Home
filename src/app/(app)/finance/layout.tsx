"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/shared/PageHeader";

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

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={SECTION_TITLES[section] ?? "การเงิน"} fallbackHref="/finance" />
      {children}
    </div>
  );
}
