import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sw = readFileSync("public/sw.js", "utf8");
const settings = readFileSync("src/features/notifications/components/NotificationSettings.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20260916110000_push_notifications.sql", "utf8");
const scheduler = readFileSync("supabase/migrations/20260916111500_schedule_push_notifications.sql", "utf8");

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
    expect(migration).toContain("unique (subscription_id, source_type, source_id, occurrence_key, notification_kind)");
    expect(migration).toContain("to service_role");
  });

  it("dispatches from Vault-backed Cron once per minute", () => {
    expect(scheduler).toContain("'* * * * *'");
    expect(scheduler).toContain("vault.decrypted_secrets");
    expect(scheduler).toContain("x-cron-secret");
  });
});
