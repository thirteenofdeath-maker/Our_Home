const BANGKOK_TIME_ZONE = "Asia/Bangkok";

export type HomeCoverMode =
  "birthday" | "morning" | "afternoon" | "evening" | "late-night";

export function bangkokHour(now = new Date()) {
  const hour = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: BANGKOK_TIME_ZONE,
  }).format(now);
  return Number(hour);
}

export function greetingForBangkok(now = new Date()) {
  const hour = bangkokHour(now);
  if (hour >= 5 && hour < 12) return "สวัสดีตอนเช้า";
  if (hour >= 12 && hour < 17) return "สวัสดีตอนบ่าย";
  if (hour >= 17 && hour < 21) return "สวัสดีตอนเย็น";
  return "สวัสดีตอนดึก";
}

function bangkokMonthDay(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    timeZone: BANGKOK_TIME_ZONE,
  }).formatToParts(now);
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${month}-${day}`;
}

export function homeCoverMode(
  birthday: string | null | undefined,
  now = new Date(),
): HomeCoverMode {
  if (birthday?.slice(5) === bangkokMonthDay(now)) return "birthday";

  const hour = bangkokHour(now);
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "late-night";
}
