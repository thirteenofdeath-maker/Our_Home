import type { ReactNode } from "react";

/**
 * Distinct from EmptyState — "we tried to load this and it failed" is a
 * different fact from "we loaded this and there is genuinely nothing
 * here", and must never render the same way (a failure must not be
 * misrepresented as "no data"). Only ever takes a caller-supplied, safe
 * user-facing message — never a raw error/exception, SQL detail, or
 * internal identifier; those belong in server-side logging only (see
 * logDatabaseErrorInDev), never in this component's props.
 */
export function ErrorState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-card border border-danger/40 bg-danger/10 p-8 text-center">
      <p className="font-medium text-danger">{title}</p>
      {description ? <p className="text-sm text-foreground-muted">{description}</p> : null}
      {action}
    </div>
  );
}
