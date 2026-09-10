import Link from "next/link";

import { Card } from "@/components/ui/Card";

import type { TemplateSummary } from "../types";

const TYPE_LABEL: Record<"INCOME" | "EXPENSE", string> = {
  INCOME: "รายรับ",
  EXPENSE: "รายจ่าย",
};

export function TemplateCard({ item }: { item: TemplateSummary }) {
  return (
    <Link href={`/finance/templates/${item.templateId}`}>
      <Card className={`flex items-center justify-between ${item.archivedAt ? "opacity-60" : ""}`}>
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-foreground-muted">
            {TYPE_LABEL[item.transactionType]}
            {item.categoryName ? ` · ${item.categoryName}` : ""}
            {item.walletName ? ` · ${item.walletName}` : ""}
          </p>
        </div>
        {item.amount ? (
          // No stored currency on a Template (it's a default suggestion,
          // not tied to a real transaction until Use — see
          // docs/FINANCE.md Phase F), so this is a plain number, not a
          // formatted currency amount.
          <span className={`tabular-nums ${item.transactionType === "EXPENSE" ? "text-expense" : "text-income"}`}>{item.amount}</span>
        ) : null}
      </Card>
    </Link>
  );
}
