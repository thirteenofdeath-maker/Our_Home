import type { ReactNode, SVGProps } from "react";

export type AppIconName =
  | "back"
  | "home"
  | "plus"
  | "income"
  | "expense"
  | "transfer"
  | "wallet"
  | "pocket"
  | "chevron"
  | "more"
  | "finance"
  | "pets"
  | "calendar"
  | "household"
  | "search"
  | "filter"
  | "info"
  | "bell"
  | "shopping"
  | "chores"
  | "inventory";

const paths: Record<AppIconName, ReactNode> = {
  back: <path d="m15 18-6-6 6-6" />,
  home: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  income: <path d="M12 19V5m0 0-5 5m5-5 5 5" />,
  expense: <path d="M12 5v14m0 0-5-5m5 5 5-5" />,
  transfer: <path d="M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3 3m-3-3 3-3" />,
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5z" />
      <path d="M15 11h4v4h-4a2 2 0 0 1 0-4Z" />
    </>
  ),
  pocket: (
    <>
      <path d="M5 6h14v12H5z" />
      <path d="M5 10h14M9 6V4h6v2" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
  finance: (
    <>
      <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />
    </>
  ),
  pets: (
    <>
      <circle cx="7" cy="8" r="2" />
      <circle cx="17" cy="8" r="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M7 16c0-3 2-5 5-5s5 2 5 5c0 2-2 3-5 3s-5-1-5-3Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4m8-4v4M3 10h18" />
    </>
  ),
  household: (
    <>
      <path d="m3 11 9-7 9 7" />
      <path d="M5 10v10h14V10m-9 10v-6h4v6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  shopping: (
    <>
      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </>
  ),
  chores: (
    <>
      <path d="M4 7h10M4 12h10M4 17h7" />
      <path d="m17 15 2 2 3-4" />
      <circle cx="2.5" cy="7" r=".5" />
      <circle cx="2.5" cy="12" r=".5" />
      <circle cx="2.5" cy="17" r=".5" />
    </>
  ),
  inventory: (
    <>
      <path d="M4 7h16v13H4zM3 4h18v3H3z" />
      <path d="M9 11h6M12 11v5" />
    </>
  ),
};

export function AppIcon({
  name,
  ...props
}: { name: AppIconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
