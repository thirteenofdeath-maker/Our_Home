import type { ReactNode } from "react";

import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { cn } from "@/lib/utils/cn";

const TONE_CLASS = {
  morning: "cover-morning text-[#435044]",
  day: "cover-day text-[#334753]",
  evening: "cover-evening text-[#56433f]",
  night: "cover-night text-white",
  finance: "cover-finance text-white",
  plan: "cover-plan text-[#3f4e49]",
  pets: "cover-pets text-[#56433f]",
  family: "cover-family text-[#3f4d43]",
  birthday: "cover-birthday text-[#514136]",
} as const;

export type CoverTone = keyof typeof TONE_CLASS;

export function TopLevelCover({
  eyebrow,
  title,
  description,
  icon,
  tone,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon: AppIconName;
  tone: CoverTone;
  children?: ReactNode;
}) {
  return (
    <header
      className={cn(
        "top-level-cover relative isolate min-h-36 overflow-hidden rounded-[1.75rem] px-5 py-5 shadow-card",
        TONE_CLASS[tone],
      )}
    >
      <div className="cover-orb cover-orb-one" aria-hidden="true" />
      <div className="cover-orb cover-orb-two" aria-hidden="true" />
      <div className="relative z-10 flex min-h-26 items-center justify-between gap-4">
        <div className="min-w-0 max-w-[75%]">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-70">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-1 text-[1.65rem] font-bold leading-tight tracking-[-0.025em]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-sm leading-5 opacity-80">{description}</p>
          ) : null}
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
        <div
          className="cover-icon flex size-20 shrink-0 items-center justify-center rounded-[1.65rem] border border-white/45 bg-white/35 shadow-[0_14px_35px_rgb(45_55_50_/_0.12)] backdrop-blur-sm"
          aria-hidden="true"
        >
          <AppIcon name={icon} className="size-10" />
        </div>
      </div>
    </header>
  );
}
