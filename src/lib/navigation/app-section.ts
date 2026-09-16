export type AppSection =
  | "home"
  | "finance"
  | "pets"
  | "calendar"
  | "household"
  | "neutral"
  | "onboarding";

/**
 * The single source of truth for "which app section does this route
 * belong to" — AppShell (BottomNav visibility/clearance/FAB gating) and
 * BottomNav (active tab + Finance V2 tone) both read this instead of
 * each re-deriving their own pathname prefix list, so the two can never
 * drift out of sync (e.g. AppShell showing the Finance FAB on a route
 * BottomNav doesn't consider "Finance").
 *
 * Order matters only in that every prefix here is disjoint from every
 * other — no route can ever match two entries — so array order has no
 * observable effect; longest-prefix-wins semantics are never needed.
 */
const SECTION_PREFIXES: ReadonlyArray<readonly [string, AppSection]> = [
  ["/onboarding", "onboarding"],
  ["/finance", "finance"],
  ["/wallets", "finance"],
  ["/categories", "finance"],
  ["/pets", "pets"],
  ["/calendar", "calendar"],
  ["/household", "household"],
  ["/profile", "neutral"],
];

export function appSectionForPath(pathname: string): AppSection {
  if (pathname === "/") return "home";
  for (const [prefix, section] of SECTION_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`))
      return section;
  }
  return "neutral";
}

/** The five primary destinations — the only sections that get an active tab. */
export const BOTTOM_NAV_SECTIONS: readonly AppSection[] = [
  "home",
  "finance",
  "calendar",
  "pets",
  "household",
];
