import { PageHeader } from "@/components/shared/PageHeader";
import { NotificationSettings } from "@/features/notifications/components/NotificationSettings";
import { requireUser } from "@/lib/auth/require-user";

const defaults = {
  plan_enabled: true,
  pets_enabled: true,
  finance_enabled: true,
  day_before_enabled: true,
  due_day_enabled: true,
  member_birthdays_enabled: true,
  pet_birthdays_enabled: true,
  birthday_week_before_enabled: true,
};

export default async function NotificationSettingsPage() {
  const { supabase, user } = await requireUser();
  const [{ data: preferences }, { data: subscriptions }, { data: config, error: configError }] = await Promise.all([
    supabase.from("notification_preferences").select("plan_enabled,pets_enabled,finance_enabled,day_before_enabled,due_day_enabled,member_birthdays_enabled,pet_birthdays_enabled,birthday_week_before_enabled").eq("user_id", user.id).maybeSingle(),
    supabase.from("push_subscriptions").select("id").eq("user_id", user.id).limit(1),
    supabase.rpc("get_push_public_config"),
  ]);
  if (configError || !config?.[0]?.vapid_public_key) throw new Error("Push notification configuration is unavailable");

  return <div className="finance-scope flex min-w-0 flex-col gap-4 pb-8">
    <PageHeader title="การแจ้งเตือน" backHref="/" />
    <NotificationSettings
      userId={user.id}
      vapidPublicKey={config[0].vapid_public_key}
      initialPreferences={preferences ?? defaults}
      initiallySubscribed={Boolean(subscriptions?.length)}
    />
  </div>;
}
