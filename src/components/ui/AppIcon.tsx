import type { ReactNode, SVGProps } from "react";

export type AppIconName =
  | "back"
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
  | "filter";

const paths: Record<AppIconName, ReactNode> = {
  back: <path d="m15 18-6-6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  income: <path d="M12 19V5m0 0-5 5m5-5 5 5" />,
  expense: <path d="M12 5v14m0 0-5-5m5 5 5-5" />,
  transfer: <path d="M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3 3m-3-3 3-3" />,
  wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5z" /><path d="M15 11h4v4h-4a2 2 0 0 1 0-4Z" /></>,
  pocket: <><path d="M5 6h14v12H5z" /><path d="M5 10h14M9 6V4h6v2" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
  finance: <><path d="M4 19V9m6 10V5m6 14v-7m4 7H2" /></>,
  pets: <><circle cx="7" cy="8" r="2" /><circle cx="17" cy="8" r="2" /><circle cx="12" cy="5" r="2" /><path d="M7 16c0-3 2-5 5-5s5 2 5 5c0 2-2 3-5 3s-5-1-5-3Z" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4m8-4v4M3 10h18" /></>,
  household: <><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10m-9 10v-6h4v6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4.3-4.3" /></>,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
};

export function AppIcon({ name, ...props }: { name: AppIconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
