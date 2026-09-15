const BANGKOK_TIME_ZONE = "Asia/Bangkok";

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
