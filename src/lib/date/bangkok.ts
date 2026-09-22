export const BANGKOK_TIME_ZONE = "Asia/Bangkok";

export function bangkokDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function shiftDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function ageOnBangkokDate(
  birthday: string | null,
  now = new Date(),
): number | null {
  if (!birthday) return null;
  const [year, month, day] = birthday.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = bangkokDateKey(now)
    .split("-")
    .map(Number);
  let age = todayYear - year;
  if (todayMonth < month || (todayMonth === month && todayDay < day)) age--;
  return age;
}
