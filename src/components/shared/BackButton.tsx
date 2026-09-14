import Link from "next/link";

import { AppIcon } from "@/components/ui/AppIcon";

/**
 * Hierarchy Back, not browser-history Back. `backHref` is the semantic
 * parent route for this exact page — supplied by the caller, who already
 * knows its own real parent (e.g. a wallet's own id), never guessed by
 * parsing the URL string here.
 *
 * Deliberately unconditional: no inspection of the browser's navigation
 * record, no referring-page check, no imperative history pop of any
 * kind. A record of a prior page existing is never proof that page
 * belongs to Our Home — a direct deep link arriving from an external
 * site, another app, or a shared link can carry that same signal while
 * having nothing to do with this app at all, and popping to it would
 * leave Our Home entirely. Always navigating to the known-correct
 * semantic href is the only choice that can never strand the user
 * outside the app, so it's unconditional — no client-only state, no
 * branching, a plain server-renderable `Link`.
 */
export function BackButton({ backHref }: { backHref: string }) {
  return (
    <Link
      href={backHref}
      aria-label="ย้อนกลับ"
      className="flex size-11 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-muted"
    >
      <AppIcon name="back" className="size-5" />
    </Link>
  );
}
