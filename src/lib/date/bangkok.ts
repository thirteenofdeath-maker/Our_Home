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

export function bangkokDateTimeInput(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function bangkokDateTimeInputForDate(
  dateKey: string,
  now = new Date(),
): string {
  const time = bangkokDateTimeInput(now).slice(11);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    ? `${dateKey}T${time}`
    : bangkokDateTimeInput(now);
}

export function bangkokDateTimeInputFromIso(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.valueOf()) ? "" : bangkokDateTimeInput(date);
}

/**
 * Converts a value from an HTML datetime-local control into the exact
 * Bangkok instant stored by Finance. Date-only input remains accepted for
 * compatibility with older clients and is mapped to noon, matching the
 * previous behavior.
 */
export function parseBangkokDateTimeInput(value: string): Date | null {
  const source = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00` : value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(source)) return null;
  const date = new Date(`${source}:00+07:00`);
  return Number.isNaN(date.valueOf()) ? null : date;
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
