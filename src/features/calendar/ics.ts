export type IcsEntry = {
  uid: string;
  title: string;
  description?: string | null;
  url?: string | null;
  allDayDate?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  recurrence?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | null;
};

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function utcStamp(value: string | Date) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function dateStamp(value: string) {
  return value.replaceAll("-", "");
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function foldLine(line: string) {
  const pieces: string[] = [];
  let current = "";
  let bytes = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).length;
    const limit = pieces.length ? 74 : 75;
    if (bytes + size > limit && current) {
      pieces.push(current);
      current = character;
      bytes = size;
    } else {
      current += character;
      bytes += size;
    }
  }
  pieces.push(current);
  return pieces.join("\r\n ");
}

export function buildIcsCalendar(
  entries: IcsEntry[],
  generatedAt = new Date(),
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Our Home//Calendar Export//TH",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Our Home",
  ];
  for (const entry of entries) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(entry.uid)}@our-home`,
      `DTSTAMP:${utcStamp(generatedAt)}`,
    );
    if (entry.allDayDate) {
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(entry.allDayDate)}`);
      lines.push(`DTEND;VALUE=DATE:${dateStamp(nextDate(entry.allDayDate))}`);
    } else if (entry.startsAt) {
      lines.push(`DTSTART:${utcStamp(entry.startsAt)}`);
      if (entry.endsAt) lines.push(`DTEND:${utcStamp(entry.endsAt)}`);
    }
    lines.push(`SUMMARY:${escapeText(entry.title)}`);
    if (entry.description)
      lines.push(`DESCRIPTION:${escapeText(entry.description)}`);
    if (entry.url) lines.push(`URL:${entry.url}`);
    if (entry.recurrence) lines.push(`RRULE:FREQ=${entry.recurrence}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export function bangkokDueDateTime(date: string, time: string) {
  return new Date(`${date}T${time.slice(0, 5)}:00+07:00`).toISOString();
}
