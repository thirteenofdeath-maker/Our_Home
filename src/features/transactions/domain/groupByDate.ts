import type { TransactionHistoryItem } from "../types";

function dateKeyFromIso(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function shiftDateKey(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export interface TransactionDateGroup {
  key: string;
  label: string;
  items: TransactionHistoryItem[];
}

/**
 * Groups already-ordered transaction rows into date buckets for display
 * — "วันนี้"/"เมื่อวาน" for the two most recent Bangkok calendar days,
 * a formatted Thai date otherwise. Presentation grouping only: it never
 * reorders, filters, or drops a field from any row — the input order
 * within each group is preserved exactly as given.
 */
export function groupTransactionsByDate(items: TransactionHistoryItem[], today: string): TransactionDateGroup[] {
  const yesterday = shiftDateKey(today, -1);
  const groups: TransactionDateGroup[] = [];
  const indexByKey = new Map<string, number>();

  for (const item of items) {
    const key = dateKeyFromIso(item.occurredAt);
    let index = indexByKey.get(key);
    if (index === undefined) {
      const label =
        key === today
          ? "วันนี้"
          : key === yesterday
            ? "เมื่อวาน"
            : new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(`${key}T00:00:00+07:00`));
      index = groups.length;
      indexByKey.set(key, index);
      groups.push({ key, label, items: [] });
    }
    groups[index]!.items.push(item);
  }

  return groups;
}
