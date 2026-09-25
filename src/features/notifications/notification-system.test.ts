import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sw = readFileSync("public/sw.js", "utf8");
const settings = readFileSync(
  "src/features/notifications/components/NotificationSettings.tsx",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260916110000_push_notifications.sql",
  "utf8",
);
const scheduler = readFileSync(
  "supabase/migrations/20260916111500_schedule_push_notifications.sql",
  "utf8",
);
const birthdayMigration = readFileSync(
  "supabase/migrations/20260922080120_birthday_notifications.sql",
  "utf8",
);
const digestMigration = readFileSync(
  "supabase/migrations/20260922133136_notification_digests.sql",
  "utf8",
);
const historyMigration = readFileSync(
  "supabase/migrations/20260925001634_notification_history.sql",
  "utf8",
);
const dispatcher = readFileSync(
  "supabase/functions/dispatch-notifications/index.ts",
  "utf8",
);
const birthdayDispatcher = readFileSync(
  "supabase/functions/dispatch-notifications/birthday.ts",
  "utf8",
);
const historyPage = readFileSync(
  "src/app/(app)/profile/notifications/page.tsx",
  "utf8",
);
const historyList = readFileSync(
  "src/features/notifications/components/NotificationHistoryList.tsx",
  "utf8",
);

describe("push notification system", () => {
  it("handles Push delivery and deep-link clicks in the service worker", () => {
    expect(sw).toContain('addEventListener("push"');
    expect(sw).toContain('addEventListener("notificationclick"');
    expect(sw).toContain("clients.openWindow(target)");
  });

  it("requests permission only from the explicit enable action", () => {
    expect(settings).toContain("async function enableNotifications()");
    expect(settings).toContain("Notification.requestPermission()");
    expect(settings).toContain("pushManager.subscribe");
    expect(settings).toContain('body: { mode: "test" }');
  });

  it("keeps subscriptions user-scoped and deliveries idempotent", () => {
    expect(migration).toContain("push_subscriptions_select_own");
    expect(migration).toContain("push_subscriptions_insert_own");
    expect(migration).toContain(
      "unique (subscription_id, source_type, source_id, occurrence_key, notification_kind)",
    );
    expect(migration).toContain("to service_role");
  });

  it("dispatches from Vault-backed Cron once per minute", () => {
    expect(scheduler).toContain("'* * * * *'");
    expect(scheduler).toContain("vault.decrypted_secrets");
    expect(scheduler).toContain("x-cron-secret");
  });

  it("keeps shared birthdays private and excludes observers from delivery", () => {
    expect(birthdayMigration).toContain(
      "share_birthday_with_household boolean not null default false",
    );
    expect(birthdayMigration).toContain("MEMBER_BIRTHDAY");
    expect(birthdayMigration).toContain("PET_BIRTHDAY");
    expect(birthdayDispatcher).toContain('member.role !== "observer"');
    expect(dispatcher).toContain('preferenceKey: "member_birthdays_enabled"');
    expect(dispatcher).toContain('preferenceKey: "pet_birthdays_enabled"');
  });

  it("combines scheduled items into daily and weekly summaries", () => {
    expect(digestMigration).toContain(
      "digest_mode_enabled boolean not null default true",
    );
    expect(digestMigration).toContain("'DAILY_DIGEST','WEEKLY_DIGEST'");
    expect(dispatcher).toContain('candidate.sourceType === "DAILY_DIGEST"');
    expect(dispatcher).toContain(
      "preference.digest_mode_enabled ? !isDigest : isDigest",
    );
  });

  it("stores one RLS-protected in-app history item per user, not per device", () => {
    expect(historyMigration).toContain(
      "create table public.notification_history",
    );
    expect(historyMigration).toContain(
      "unique (user_id, source_type, source_id, occurrence_key, notification_kind)",
    );
    expect(historyMigration).toContain("notification_history_select_own");
    expect(historyMigration).toContain("notification_history_mark_read_own");
    expect(historyMigration).toContain(
      "grant select, update(read_at) on public.notification_history to authenticated",
    );
    expect(dispatcher).toContain('.from("notification_history")');
    expect(dispatcher).toContain("eligibleUsers");
  });

  it("shows notification history with read state and keeps settings on a child route", () => {
    expect(historyPage).toContain("NotificationHistoryList");
    expect(historyPage).toContain("/profile/notifications/settings");
    expect(historyList).toContain("อ่านทั้งหมด");
    expect(historyList).toContain(".update({ read_at: readAt })");
  });
});
