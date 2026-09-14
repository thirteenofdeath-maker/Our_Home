import type { ReactNode } from "react";

import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";

/**
 * Shared compact empty state for the Finance V2 module pages — never the
 * old "one huge button floating in a blank page" pattern. Sits inline
 * within the page's own flow (no full-viewport centering), so it never
 * introduces large dead space above/below it.
 */
export function FinanceEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: AppIconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[1.25rem] bg-finance-surface-strong px-6 py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-finance-primary-soft text-finance-primary-strong">
        <AppIcon name={icon} className="size-6" />
      </span>
      <p className="font-semibold text-finance-text">{title}</p>
      {description ? <p className="text-sm text-finance-muted">{description}</p> : null}
      {action ? <div className="mt-1 w-full">{action}</div> : null}
    </div>
  );
}
