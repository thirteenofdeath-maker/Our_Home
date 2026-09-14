import type { Database } from "@/types/database";
import type { TagOption } from "@/features/tags/types";

export type RecurringTransaction = Database["public"]["Tables"]["recurring_transactions"]["Row"];
export type RecurringOccurrence = Database["public"]["Tables"]["recurring_occurrences"]["Row"];

export type RecurringFrequency = "WEEKLY" | "MONTHLY" | "YEARLY";
export type OccurrenceStatus = "UPCOMING" | "POSTED" | "SKIPPED";

/**
 * Read model for the rule list/detail views — resolved names plus "is
 * this saved reference now stale" flags, mirroring TemplateSummary
 * (docs/FINANCE.md Phase G reuses Phase F's stale-reference pattern
 * exactly). `tags` includes archived ones for historical display; a
 * caller that needs only usable tags (posting an occurrence) filters
 * by `archivedAt === null` itself.
 */
export interface RecurringSummary {
  recurringId: string;
  scope: "PERSONAL" | "HOUSEHOLD";
  ownerUserId: string | null;
  householdId: string | null;
  transactionType: "INCOME" | "EXPENSE";
  name: string;
  amount: string;
  title: string | null;
  note: string | null;
  frequency: RecurringFrequency;
  intervalCount: number;
  startDate: string;
  endDate: string | null;
  pausedAt: string | null;
  archivedAt: string | null;
  walletId: string | null;
  walletName: string | null;
  walletArchived: boolean;
  pocketId: string | null;
  pocketName: string | null;
  pocketArchived: boolean;
  categoryId: string | null;
  categoryName: string | null;
  categoryArchived: boolean;
  tags: Array<TagOption & { archivedAt: string | null }>;
}

/**
 * Read model for one occurrence, joined with its whole rule so both a
 * list row (name/amount/due date/status) and the posting flow's prefill
 * (wallet/pocket/category/tags + stale flags, same shape as
 * TemplateSummary) come from one query — an occurrence is never read
 * without its rule's context.
 */
export interface OccurrenceSummary {
  occurrenceId: string;
  dueDate: string;
  status: OccurrenceStatus;
  postedTransactionId: string | null;
  postedAt: string | null;
  skippedAt: string | null;
  /** True when `postedTransactionId` refers to a transaction that has since been voided (Phase B) — surfaced, never hidden. See docs/FINANCE.md Phase G "Void interaction". */
  postedTransactionVoided: boolean;
  recurringId: string;
  scope: "PERSONAL" | "HOUSEHOLD";
  ownerUserId: string | null;
  householdId: string | null;
  transactionType: "INCOME" | "EXPENSE";
  name: string;
  amount: string;
  title: string | null;
  note: string | null;
  walletId: string | null;
  walletName: string | null;
  walletArchived: boolean;
  walletCurrency: string | null;
  pocketId: string | null;
  pocketName: string | null;
  pocketArchived: boolean;
  categoryId: string | null;
  categoryName: string | null;
  categoryArchived: boolean;
  tags: Array<TagOption & { archivedAt: string | null }>;
}

const FREQUENCY_LABEL: Record<RecurringFrequency, string> = { WEEKLY: "สัปดาห์", MONTHLY: "เดือน", YEARLY: "ปี" };

/** "ทุกสัปดาห์" / "ทุก 2 สัปดาห์" / "ทุกเดือน" / "ทุก 3 เดือน" / "ทุกปี" — used by the create/edit form, cards, and Finance Hub. */
export function frequencyLabel(frequency: RecurringFrequency, intervalCount: number): string {
  if (intervalCount <= 1) return `ทุก${FREQUENCY_LABEL[frequency]}`;
  return `ทุก ${intervalCount} ${FREQUENCY_LABEL[frequency]}`;
}

/** "YYYY-MM-DD" -> "25 ก.ย. 2569" — `due_date`/`start_date`/`end_date` are canonical DATE strings, interpreted as a Bangkok calendar date (docs/DOMAIN_RULES.md date contract). */
export function formatFinanceDate(date: string): string {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(`${date}T00:00:00+07:00`));
}
