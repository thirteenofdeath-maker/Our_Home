import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-surface-muted p-8 text-center">
      <p className="font-medium text-foreground">{title}</p>
      {description ? <p className="text-sm text-foreground-muted">{description}</p> : null}
      {action}
    </div>
  );
}
