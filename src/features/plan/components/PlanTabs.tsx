import Link from "next/link";

import { cn } from "@/lib/utils/cn";

export type PlanView = "calendar" | "tasks" | "notes";

const views: Array<{ value: PlanView; label: string }> = [
  { value: "calendar", label: "ปฏิทิน" },
  { value: "tasks", label: "งาน" },
  { value: "notes", label: "โน้ต" },
];

export function PlanTabs({ active }: { active: PlanView }) {
  return (
    <nav aria-label="มุมมองแพลน" className="grid grid-cols-3 rounded-[1.2rem] bg-surface p-1 shadow-sm">
      {views.map((view) => (
        <Link
          key={view.value}
          href={view.value === "calendar" ? "/calendar" : `/calendar?view=${view.value}`}
          aria-current={active === view.value ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center justify-center rounded-control px-3 text-sm font-medium",
            active === view.value ? "bg-primary-soft text-foreground shadow-sm" : "text-foreground-muted",
          )}
        >
          {view.label}
        </Link>
      ))}
    </nav>
  );
}
