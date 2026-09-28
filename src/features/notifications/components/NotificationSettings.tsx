"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type Preferences = {
  plan_enabled: boolean;
  pets_enabled: boolean;
  finance_enabled: boolean;
  inventory_enabled: boolean;
  day_before_enabled: boolean;
  due_day_enabled: boolean;
  member_birthdays_enabled: boolean;
  pet_birthdays_enabled: boolean;
  birthday_week_before_enabled: boolean;
  digest_mode_enabled: boolean;
  daily_digest_enabled: boolean;
  weekly_digest_enabled: boolean;
};

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

export function NotificationSettings({
  userId,
  vapidPublicKey,
  initialPreferences,
  initiallySubscribed,
}: {
  userId: string;
  vapidPublicKey: string;
  initialPreferences: Preferences;
  initiallySubscribed: boolean;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [subscribed, setSubscribed] = useState(initiallySubscribed);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const supported =
    typeof window === "undefined" ||
    ("serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setSubscribed(Boolean(subscription)));
  }, []);

  async function savePreferences(next: Preferences) {
    setPreferences(next);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, ...next });
    setMessage(
      error
        ? "บันทึกการตั้งค่าไม่สำเร็จ ลองใหม่อีกครั้ง"
        : "บันทึกการตั้งค่าแล้ว",
    );
  }

  async function enableNotifications() {
    setBusy(true);
    setMessage("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        throw new Error("unsupported");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("permission");
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth)
        throw new Error("invalid");
      const supabase = createClient();
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth_key: json.keys.auth,
          user_agent: navigator.userAgent,
        },
        { onConflict: "endpoint" },
      );
      if (error) throw error;
      await supabase
        .from("notification_preferences")
        .upsert({ user_id: userId, ...preferences });
      setSubscribed(true);
      setMessage("เปิดการแจ้งเตือนแล้ว ลองส่งข้อความทดสอบได้เลย");
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === "permission"
          ? "ยังไม่ได้อนุญาตการแจ้งเตือน โปรดเปิดสิทธิ์ในการตั้งค่า iPhone"
          : "เปิดการแจ้งเตือนไม่สำเร็จ หากใช้ iPhone ให้เพิ่มแอปไว้ที่หน้าจอโฮมก่อน",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        const supabase = createClient();
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", endpoint);
      }
      setSubscribed(false);
      setMessage("ปิดการแจ้งเตือนบนอุปกรณ์นี้แล้ว");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.functions.invoke(
      "dispatch-notifications",
      { body: { mode: "test" } },
    );
    setMessage(error ? "ส่งข้อความทดสอบไม่สำเร็จ" : "ส่งข้อความทดสอบแล้ว");
    setBusy(false);
  }

  const rows: Array<[keyof Preferences, string, string]> = [
    [
      "digest_mode_enabled",
      "รวมเป็นสรุป",
      "งดแจ้งเตือนย่อยและรวมเรื่องสำคัญไว้ใน Push เดียว",
    ],
    [
      "daily_digest_enabled",
      "สรุปประจำวัน",
      "แจ้งเวลา 07:00 น. พร้อมสิ่งที่ต้องดูแลในวันนี้",
    ],
    [
      "weekly_digest_enabled",
      "สรุปประจำสัปดาห์",
      "แจ้งเย็นวันอาทิตย์สำหรับรายการสำคัญในสัปดาห์ถัดไป",
    ],
    ["plan_enabled", "แผนงาน", "งาน นัดหมาย และรายการเตือนตามเวลาที่กำหนด"],
    [
      "pets_enabled",
      "สัตว์เลี้ยง",
      "วัคซีน ยา และนัดดูแล ก่อนหนึ่งวันและวันครบกำหนด",
    ],
    ["finance_enabled", "การเงิน", "บิลและยอดบัตร ก่อนหนึ่งวันและวันครบกำหนด"],
    [
      "inventory_enabled",
      "คลังของในบ้าน",
      "ของใกล้หมด วันหมดอายุ และวันสิ้นสุดประกัน",
    ],
    [
      "member_birthdays_enabled",
      "วันเกิดสมาชิก",
      "รับเฉพาะวันเกิดที่เจ้าตัวยินยอมแชร์",
    ],
    [
      "pet_birthdays_enabled",
      "วันเกิดสัตว์เลี้ยง",
      "แจ้งเจ้าของ ผู้ดูแล และผู้รับผิดชอบสัตว์ตัวนั้น",
    ],
    [
      "birthday_week_before_enabled",
      "เตือนวันเกิดล่วงหน้า 7 วัน",
      "ช่วยให้มีเวลาเตรียมของขวัญหรือกิจกรรม",
    ],
    [
      "day_before_enabled",
      "เตือนล่วงหน้า 1 วัน",
      "แจ้งเวลา 09:00 น. ก่อนวันครบกำหนด",
    ],
    [
      "due_day_enabled",
      "เตือนในวันครบกำหนด",
      "แจ้งเวลา 09:00 น. ของวันครบกำหนด",
    ],
  ];

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[1.5rem] time-tinted-panel p-5 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/80 text-2xl">
            🔔
          </span>
          <div>
            <h2 className="font-semibold text-finance-text">
              แจ้งเตือนของ Our Home
            </h2>
            <p className="mt-1 text-sm text-finance-muted">
              รับแจ้งเตือนได้แม้ปิดแอปอยู่
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            disabled={busy || !supported}
            onClick={subscribed ? disableNotifications : enableNotifications}
          >
            {subscribed ? "ปิดบนอุปกรณ์นี้" : "เปิดการแจ้งเตือน"}
          </Button>
          {subscribed ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={sendTest}
            >
              ส่งทดสอบ
            </Button>
          ) : null}
        </div>
        {!supported ? (
          <p className="mt-3 text-sm text-danger">
            เบราว์เซอร์นี้ยังไม่รองรับ Push Notification
          </p>
        ) : null}
        <p className="mt-3 text-xs text-finance-muted">
          บน iPhone ต้องเปิด Our Home จากไอคอนที่เพิ่มไว้บนหน้าจอโฮม
          แล้วกดอนุญาตจากปุ่มด้านบน
        </p>
      </section>

      <section className="overflow-hidden rounded-[1.5rem] bg-finance-surface-strong shadow-card">
        {rows.map(([key, title, detail], index) => (
          <label
            key={key}
            className={`flex cursor-pointer items-center gap-4 p-4 ${index ? "border-t border-border" : ""}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-finance-text">
                {title}
              </span>
              <span className="mt-0.5 block text-sm text-finance-muted">
                {detail}
              </span>
            </span>
            <input
              type="checkbox"
              checked={preferences[key]}
              onChange={(event) =>
                void savePreferences({
                  ...preferences,
                  [key]: event.target.checked,
                })
              }
              className="size-6 accent-[var(--finance-primary)]"
            />
          </label>
        ))}
      </section>
      <p
        aria-live="polite"
        className={`min-h-6 text-center text-sm ${message.includes("ไม่สำเร็จ") || message.includes("ไม่ได้อนุญาต") ? "text-danger" : "text-finance-primary-strong"}`}
      >
        {message}
      </p>
    </div>
  );
}
