import type { Database } from "@/types/database";
import type { TagOption } from "@/features/tags/types";

export type TransactionTemplate = Database["public"]["Tables"]["transaction_templates"]["Row"];

/**
 * Read model for both the list and detail views — resolved names plus
 * "is this saved reference now stale" flags, so the UI can explain a
 * stale default without silently using it (docs/FINANCE.md Phase F).
 * `tags` includes archived ones (for historical display); callers that
 * need only USABLE tags (e.g. prefilling a new transaction) filter by
 * `archivedAt === null` themselves.
 */
export interface TemplateSummary {
  templateId: string;
  scope: "PERSONAL" | "HOUSEHOLD";
  ownerUserId: string | null;
  householdId: string | null;
  transactionType: "INCOME" | "EXPENSE";
  name: string;
  amount: string | null;
  title: string | null;
  note: string | null;
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
