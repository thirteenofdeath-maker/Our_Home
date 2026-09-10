"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AppIcon } from "@/components/ui/AppIcon";

export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="ย้อนกลับ"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallbackHref))}
      className="flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-primary-soft active:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <AppIcon name="back" />
    </button>
  );
}

export function PageHeader({ title, fallbackHref, rightAction }: { title: string; fallbackHref: string; rightAction?: ReactNode }) {
  return (
    <header className="grid h-14 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
      <BackButton fallbackHref={fallbackHref} />
      <h1 className="truncate text-center text-lg font-semibold">{title}</h1>
      <div className="flex size-11 items-center justify-center">{rightAction}</div>
    </header>
  );
}
