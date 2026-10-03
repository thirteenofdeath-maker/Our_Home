"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppIcon } from "@/components/ui/AppIcon";
import { syncAppBadge } from "@/features/notifications/app-badge";
import { createClient } from "@/lib/supabase/client";

function badgeLabel(count: number) {
  return count > 9 ? "9+" : String(count);
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    const supabase = createClient();
    const { count, error } = await supabase
      .from("notification_history")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);

    if (error) return;

    const nextCount = count ?? 0;
    setUnreadCount(nextCount);
    void syncAppBadge(nextCount);
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      void refreshUnreadCount();
    }, 0);

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") void refreshUnreadCount();
    }

    window.addEventListener("focus", refreshUnreadCount);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener("focus", refreshUnreadCount);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshUnreadCount]);

  const ariaLabel = unreadCount
    ? `ดูประวัติการแจ้งเตือน มี ${unreadCount} รายการที่ยังไม่ได้อ่าน`
    : "ดูประวัติการแจ้งเตือน";

  return (
    <Link
      href="/profile/notifications"
      aria-label={ariaLabel}
      className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/85 text-finance-primary-strong shadow-sm backdrop-blur-sm transition-transform active:scale-95"
    >
      <AppIcon name="bell" className="size-5" />
      {unreadCount > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm"
        >
          {badgeLabel(unreadCount)}
        </span>
      ) : null}
    </Link>
  );
}
