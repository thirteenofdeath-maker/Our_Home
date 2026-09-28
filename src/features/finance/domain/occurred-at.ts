export const BANGKOK_UTC_OFFSET = "+07:00";

export interface FinanceDateTimeParts {
  date: string;
  time: string;
}

function bangkokParts(date: Date): FinanceDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
}

/** Values for the finance date/time controls, always presented in Bangkok time. */
export function financeDateTimeParts(
  value?: string | Date | null,
  now = new Date(),
): FinanceDateTimeParts {
  const current = bangkokParts(now);
  if (!value) return current;

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { date: value, time: current.time };
    }
    const local = value.match(
      /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/,
    );
    if (local) return { date: local[1], time: local[2] };
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? current : bangkokParts(parsed);
}

/** Convert a browser local date/time value into an unambiguous UTC instant. */
export function financeOccurredAtToIso(value: string): string | null {
  const trimmed = value.trim();
  const dateOnly = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);
  const localDateTime = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  const candidate = dateOnly
    ? `${trimmed}T12:00:00`
    : localDateTime
      ? `${localDateTime[1]}T${localDateTime[2]}:${localDateTime[3]}:${localDateTime[4] ?? "00"}`
      : null;
  if (!candidate) return null;

  const parsed = new Date(`${candidate}${BANGKOK_UTC_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) return null;

  const expectedDate = candidate.slice(0, 10);
  const expectedTime = candidate.slice(11, 16);
  const roundTrip = bangkokParts(parsed);
  if (roundTrip.date !== expectedDate || roundTrip.time !== expectedTime) {
    return null;
  }
  return parsed.toISOString();
}
