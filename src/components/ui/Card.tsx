import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-full rounded-card bg-surface p-4 shadow-card",
        className,
      )}
      {...props}
    />
  );
}
