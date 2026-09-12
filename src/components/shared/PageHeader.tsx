import type { ReactNode } from "react";

/**
 * No application-level back arrow anymore (approved UX direction: rely on
 * BottomNav + the browser/system's own back gesture instead — see
 * PageHeader.test.ts). The title is centered against the FULL header
 * width via `justify-center` on the header itself; `rightAction`, when
 * present, is positioned `absolute` so it never claims flow space and
 * never needs a matching fake left-hand placeholder to keep the title
 * balanced — it stays centered whether or not a right action exists.
 */
export function PageHeader({ title, rightAction }: { title: string; rightAction?: ReactNode }) {
  return (
    <header className="relative flex h-14 items-center justify-center">
      <h1 className="truncate px-12 text-center text-lg font-semibold">{title}</h1>
      {rightAction ? <div className="absolute right-0 flex size-11 items-center justify-center">{rightAction}</div> : null}
    </header>
  );
}
