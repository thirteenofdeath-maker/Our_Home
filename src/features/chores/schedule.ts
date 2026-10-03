import type { ChoreCadence } from "@/types/database";

export const CHORE_WEEKDAYS = [
  "วันอาทิตย์",
  "วันจันทร์",
  "วันอังคาร",
  "วันพุธ",
  "วันพฤหัสบดี",
  "วันศุกร์",
  "วันเสาร์",
] as const;

export type ChoreScheduleMode =
  "EVERY_DAY" | "WEEKDAY" | "MONTH_DAY" | "CUSTOM";

type StoredSchedule = {
  cadence: ChoreCadence;
  interval_count: number;
  starts_on: string;
};

function utcDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function nextWeekdayOnOrAfter(startDate: string, weekday: number) {
  const start = utcDate(startDate);
  const offset = (weekday - start.getUTCDay() + 7) % 7;
  return dateKey(addUtcDays(start, offset));
}

function nextMonthDayOnOrAfter(startDate: string, monthDay: number) {
  const start = utcDate(startDate);
  for (let offset = 0; offset < 24; offset += 1) {
    const month = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1),
    );
    const daysInMonth = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
    ).getUTCDate();
    if (monthDay > daysInMonth) continue;
    const candidate = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), monthDay),
    );
    if (candidate >= start) return dateKey(candidate);
  }
  return startDate;
}

export function choreScheduleDefaults(
  template: StoredSchedule | undefined,
  fallbackStartDate: string,
) {
  if (!template) {
    return {
      mode: "EVERY_DAY" as ChoreScheduleMode,
      weekday: utcDate(fallbackStartDate).getUTCDay(),
      monthDay: utcDate(fallbackStartDate).getUTCDate(),
    };
  }
  const start = utcDate(template.starts_on);
  if (template.cadence === "DAILY" && template.interval_count === 1) {
    return {
      mode: "EVERY_DAY" as ChoreScheduleMode,
      weekday: start.getUTCDay(),
      monthDay: start.getUTCDate(),
    };
  }
  if (template.cadence === "WEEKLY" && template.interval_count === 1) {
    return {
      mode: "WEEKDAY" as ChoreScheduleMode,
      weekday: start.getUTCDay(),
      monthDay: start.getUTCDate(),
    };
  }
  if (template.cadence === "MONTHLY" && template.interval_count === 1) {
    return {
      mode: "MONTH_DAY" as ChoreScheduleMode,
      weekday: start.getUTCDay(),
      monthDay: start.getUTCDate(),
    };
  }
  return {
    mode: "CUSTOM" as ChoreScheduleMode,
    weekday: start.getUTCDay(),
    monthDay: start.getUTCDate(),
  };
}

export function resolveChoreSchedule(input: {
  mode: ChoreScheduleMode;
  startsOn: string;
  weekday: number;
  monthDay: number;
  customCadence: ChoreCadence;
  customIntervalCount: number;
}) {
  if (input.mode === "EVERY_DAY") {
    return {
      cadence: "DAILY" as const,
      intervalCount: 1,
      startsOn: input.startsOn,
    };
  }
  if (input.mode === "WEEKDAY") {
    return {
      cadence: "WEEKLY" as const,
      intervalCount: 1,
      startsOn: nextWeekdayOnOrAfter(input.startsOn, input.weekday),
    };
  }
  if (input.mode === "MONTH_DAY") {
    return {
      cadence: "MONTHLY" as const,
      intervalCount: 1,
      startsOn: nextMonthDayOnOrAfter(input.startsOn, input.monthDay),
    };
  }
  return {
    cadence: input.customCadence,
    intervalCount: input.customIntervalCount,
    startsOn: input.startsOn,
  };
}

export function groupChoresByDate<T extends { due_date: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const current = groups.get(item.due_date);
    if (current) current.push(item);
    else groups.set(item.due_date, [item]);
  }
  return [...groups.entries()].map(([date, chores]) => ({ date, chores }));
}

export function choreDayHeading(date: string, today: string) {
  if (date === today) return "วันนี้";
  if (date === dateKey(addUtcDays(utcDate(today), 1))) return "พรุ่งนี้";
  return new Intl.DateTimeFormat("th-TH", { weekday: "long" }).format(
    new Date(`${date}T12:00:00+07:00`),
  );
}

export function choreFullDate(date: string) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(
    new Date(`${date}T12:00:00+07:00`),
  );
}
