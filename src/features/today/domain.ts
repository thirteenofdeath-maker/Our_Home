const BANGKOK_TIME_ZONE = "Asia/Bangkok";

export type HomeCoverMode =
  | "birthday"
  | "morning"
  | "late-morning"
  | "midday"
  | "afternoon"
  | "evening"
  | "night"
  | "late-night";

export function bangkokHour(now = new Date()) {
  const hour = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: BANGKOK_TIME_ZONE,
  }).format(now);
  return Number(hour);
}

export function greetingForBangkok(now = new Date()) {
  switch (homeTimeCoverMode(now)) {
    case "morning":
      return "สวัสดียามเช้า";
    case "late-morning":
      return "สวัสดีตอนสาย";
    case "midday":
      return "สวัสดีตอนเที่ยง";
    case "afternoon":
      return "สวัสดีตอนบ่าย";
    case "evening":
      return "สวัสดีตอนเย็น";
    case "night":
      return "สวัสดีตอนค่ำ";
    case "late-night":
      return "สวัสดีตอนดึก";
  }
}

function homeTimeCoverMode(now: Date): Exclude<HomeCoverMode, "birthday"> {
  const hour = bangkokHour(now);
  if (hour >= 5 && hour < 8) return "morning";
  if (hour >= 8 && hour < 11) return "late-morning";
  if (hour >= 11 && hour < 14) return "midday";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening";
  if (hour >= 20 && hour < 23) return "night";
  return "late-night";
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

  return homeTimeCoverMode(now);
}
