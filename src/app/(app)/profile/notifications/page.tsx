import { PageHeader } from "@/components/shared/PageHeader";
import Link from "next/link";

import { requireUser } from "@/lib/auth/require-user";
import { NotificationHistoryList } from "@/features/notifications/components/NotificationHistoryList";

export default async function NotificationHistoryPage() {
  const { supabase, user } = await requireUser();
  const { data: history, error } = await supabase
    .from("notification_history")
    .select(
      "id,user_id,source_type,source_id,occurrence_key,notification_kind,category,title,body,url,scheduled_for,read_at,created_at",
    )
    .eq("user_id", user.id)
    .order("scheduled_for", { ascending: false })
    .limit(50);
  if (error) throw error;

  return (
    <div className="finance-scope flex min-w-0 flex-col gap-4 pb-8">
      <PageHeader
        title="การแจ้งเตือน"
        backHref="/"
        rightAction={
          <Link
            href="/profile/notifications/settings"
            className="text-xs font-semibold text-primary-strong"
          >
            ตั้งค่า
          </Link>
        }
      />
      <NotificationHistoryList initialItems={history ?? []} />
    </div>
  );
}
