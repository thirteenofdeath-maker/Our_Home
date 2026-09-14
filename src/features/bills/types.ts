import type { TagOption } from "@/features/tags/types";

export type BillRecurrence = "ONE_TIME"|"WEEKLY"|"MONTHLY"|"YEARLY";
export type BillBaseStatus = "OPEN"|"PAID"|"SKIPPED";
export type BillDisplayStatus = "UPCOMING"|"DUE"|"OVERDUE"|"PAID"|"SKIPPED";

export interface BillSummary {
  billId:string; scope:"PERSONAL"|"HOUSEHOLD"; ownerUserId:string|null; householdId:string|null;
  name:string; amount:string; currency:string; walletId:string|null; walletName:string|null; walletArchived:boolean;
  pocketId:string|null; pocketName:string|null; pocketArchived:boolean; categoryId:string; categoryName:string|null; categoryArchived:boolean;
  title:string|null; note:string|null; recurrenceType:BillRecurrence; intervalCount:number; startDate:string; endDate:string|null;
  pausedAt:string|null; archivedAt:string|null; tags:Array<TagOption & {archivedAt:string|null}>;
}

export interface BillOccurrenceSummary extends BillSummary {
  occurrenceId:string; dueDate:string; expectedAmount:string; status:BillBaseStatus; displayStatus:BillDisplayStatus;
  paidTransactionId:string|null; paidAt:string|null; skippedAt:string|null; paymentVoided:boolean; actualAmount:string|null;
}
