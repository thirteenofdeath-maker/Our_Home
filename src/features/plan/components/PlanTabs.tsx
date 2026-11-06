import Link from "next/link";

import { cn } from "@/lib/utils/cn";

export type PlanView =
  | "calendar"
  | "tasks"
  | "reminders"
  | "chores"
  | "shopping"
  | "inventory";

const views: Array<{
  value: PlanView | "expenses";
  href: string;
  label: string;
}> = [
  { value: "calendar", href: "/calendar", label: "ปฏิทิน" },
  { value: "tasks", href: "/calendar?view=tasks", label: "งาน" },
  { value: "reminders", href: "/calendar?view=reminders", label: "เตือน" },
  { value: "chores", href: "/calendar?view=chores", label: "งานบ้าน" },
  { value: "shopping", href: "/calendar?view=shopping", label: "ซื้อของ" },
  { value: "expenses", href: "/calendar/expenses", label: "ค่าใช้จ่าย" },
  { value: "inventory", href: "/calendar?view=inventory", label: "คลังของ" },
];

export function PlanTabs({ active }: { active: PlanView | "expenses" }) {
  return (
    <nav
      aria-label="ศูนย์แผนงาน"
      className="grid min-w-0 grid-cols-4 gap-1.5 rounded-[1.5rem] bg-finance-surface-strong p-2 shadow-card lg:grid-cols-7"
    >
      {views.map((view) => (
        <Link
          key={view.value}
          href={view.href}
          aria-current={active === view.value ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 items-center justify-center rounded-[1rem] px-1 py-2 text-center text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-finance-primary",
            active === view.value
              ? "bg-finance-primary text-finance-primary-foreground shadow-sm"
              : "bg-finance-primary-soft/30 text-finance-text hover:bg-finance-primary-soft/60",
          )}
        >
          {view.label}
        </Link>
      ))}
    </nav>
  );
}
