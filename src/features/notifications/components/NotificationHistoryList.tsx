"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { Button } from "@/components/ui/Button";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

type HistoryItem = Database["public"]["Tables"]["notification_history"]["Row"];

const CATEGORY_META: Record<
  HistoryItem["category"],
  { icon: AppIconName; label: string }
> = {
  plan: { icon: "calendar", label: "แผนงาน" },
  pets: { icon: "pets", label: "สัตว์เลี้ยง" },
  finance: { icon: "finance", label: "การเงิน" },
  inventory: { icon: "inventory", label: "คลังของ" },
};

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

export function NotificationHistoryList({
  initialItems,
}: {
  initialItems: HistoryItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState(false);
  const unreadCount = items.filter((item) => !item.read_at).length;

  async function markAllRead() {
    if (!unreadCount) return;
    setBusy(true);
    const readAt = new Date().toISOString();
    const supabase = createClient();
    const { error } = await supabase
      .from("notification_history")
      .update({ read_at: readAt })
      .is("read_at", null);
    if (!error)
      setItems((current) =>
        current.map((item) => ({ ...item, read_at: item.read_at ?? readAt })),
      );
    setBusy(false);
  }

  async function openItem(item: HistoryItem) {
    if (!item.read_at) {
      const readAt = new Date().toISOString();
      const supabase = createClient();
      const { error } = await supabase
        .from("notification_history")
        .update({ read_at: readAt })
        .eq("id", item.id);
      if (!error)
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, read_at: readAt } : entry,
          ),
        );
    }
    router.push(item.url);
  }

  if (!items.length)
    return (
      <section className="rounded-[1.5rem] bg-surface p-6 text-center shadow-card">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
          <AppIcon name="bell" className="size-6" />
        </span>
        <h2 className="mt-3 font-semibold">ยังไม่มีประวัติแจ้งเตือน</h2>
        <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
          รายการใหม่ที่ระบบแจ้งจะถูกเก็บไว้ที่นี่
        </p>
      </section>
    );

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">ล่าสุด</h2>
          <p className="text-xs text-foreground-muted">
            {unreadCount
              ? `ยังไม่ได้อ่าน ${unreadCount} รายการ`
              : "อ่านครบแล้ว"}
          </p>
        </div>
        {unreadCount ? (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={markAllRead}
            className="w-auto px-3"
          >
            อ่านทั้งหมด
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[1.5rem] bg-surface shadow-card">
        {items.map((item, index) => {
          const meta = CATEGORY_META[item.category];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => openItem(item)}
              className={`flex w-full min-w-0 items-start gap-3 p-4 text-left transition-colors active:bg-surface-muted ${
                index ? "border-t border-border" : ""
              }`}
            >
              <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
                <AppIcon name={meta.icon} className="size-5" />
                {!item.read_at ? (
                  <span className="absolute right-0 top-0 size-2.5 rounded-full border-2 border-surface bg-primary" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold leading-snug">
                    {item.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-foreground-muted">
                    {timeLabel(item.scheduled_for)}
                  </span>
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-foreground-muted">
                  {item.body}
                </span>
                <span className="mt-1.5 block text-xs font-medium text-primary-strong">
                  {meta.label}
                </span>
              </span>
              <AppIcon
                name="chevron"
                className="mt-2 size-4 shrink-0 text-foreground-muted"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
