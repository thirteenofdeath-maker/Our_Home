import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { buildCategoryTree } from "@/features/categories/domain/tree";
import { listCategoriesForWallet } from "@/features/categories/api";
import { FINANCE_RETURN_TO } from "@/features/finance/domain/finance";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listPocketsForWallet } from "@/features/pockets/api";
import { getCurrentProfile } from "@/features/profile/api";
import { getOccurrence } from "@/features/recurring/api";
import { getTemplate } from "@/features/templates/api";
import { listTags } from "@/features/tags/api";
import type { HouseholdExpenseContext } from "@/features/transactions/components/TransactionForm";
import { TransactionForm } from "@/features/transactions/components/TransactionForm";
import { getWallet, listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function NewTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ walletId: string }>;
  searchParams: Promise<{ type?: string; returnTo?: string; templateId?: string; occurrenceId?: string }>;
}) {
  const { walletId } = await params;
  const { type, returnTo, templateId, occurrenceId } = await searchParams;
  const transactionType = type === "EXPENSE" ? "EXPENSE" : "INCOME";
  // Same whitelist as the Server Action (transactions/actions.ts) — kept
  // here too so an unrecognized value never reaches the form at all.
  const safeReturnTo = returnTo === FINANCE_RETURN_TO ? FINANCE_RETURN_TO : undefined;

  const { supabase, user } = await requireUser();
  const [wallet, wallets] = await Promise.all([getWallet(supabase, walletId), listMyWallets(supabase)]);
  if (!wallet) notFound();

  const [pockets, categories, tags] = await Promise.all([
    listPocketsForWallet(supabase, walletId),
    listCategoriesForWallet(supabase, { transactionType, wallet }),
    listTags(supabase, { scope: wallet.scope, householdId: wallet.household_id }),
  ]);

  // Phase U (0051): the explicit-scope household-expense flow is only
  // ever relevant for EXPENSE creation, and only when the caller actually
  // has a household to attribute to — with none, "ครอบครัว" would offer
  // nothing selectable, so the form falls back to its existing implicit
  // behavior entirely (see TransactionForm's isHouseholdExpenseFlow gate).
  let householdExpenseContext: HouseholdExpenseContext | undefined;
  if (transactionType === "EXPENSE") {
    const [household, profile] = await Promise.all([getMyPrimaryHousehold(supabase, user.id), getCurrentProfile(supabase, user.id)]);
    if (household) {
      const householdWallets = wallets.filter((w) => w.scope === "HOUSEHOLD" && w.household_id === household.id);
      const personalWallets = wallets.filter((w) => w.scope === "PERSONAL" && w.owner_user_id === user.id);
      const eligibleWallets = [...householdWallets, ...personalWallets];
      const [householdCategories, pocketsByWalletEntries] = await Promise.all([
        listCategoriesForWallet(supabase, {
          transactionType: "EXPENSE",
          wallet: { scope: "HOUSEHOLD", owner_user_id: null, household_id: household.id },
        }),
        Promise.all(eligibleWallets.map(async (w) => [w.id, await listPocketsForWallet(supabase, w.id)] as const)),
      ]);
      householdExpenseContext = {
        household: { id: household.id, name: household.name },
        payerDisplayName: profile?.display_name ?? "คุณ",
        householdCategories: buildCategoryTree(householdCategories),
        householdWallets: householdWallets.map(({ id, name, currency }) => ({ id, name, currency })),
        personalWallets: personalWallets.map(({ id, name, currency }) => ({ id, name, currency })),
        pocketsByWallet: Object.fromEntries(pocketsByWalletEntries),
      };
    }
  }

  // "ใช้ Template" prefill (docs/FINANCE.md Phase F). templateId is
  // authoritative — the server loads and re-validates it; nothing about
  // the actual prefill values travels through the URL itself. A
  // Template whose type doesn't match this page's `?type=`, or that
  // belongs to a different owner/household than this Wallet, is ignored
  // outright rather than trusted.
  const template = templateId ? await getTemplate(supabase, templateId) : null;
  const templateApplies =
    template &&
    !template.archivedAt &&
    template.transactionType === transactionType &&
    (template.scope === "PERSONAL" ? template.ownerUserId === wallet.owner_user_id : template.householdId === wallet.household_id);

  const staleNotices: string[] = [];
  if (templateApplies && template) {
    if (template.pocketId && template.pocketArchived) {
      staleNotices.push("Pocket ที่บันทึกไว้ถูก Archive แล้ว กรุณาเลือก Pocket ใหม่ก่อนบันทึก");
    }
    if (template.categoryId && template.categoryArchived) {
      staleNotices.push("หมวดหมู่ที่บันทึกไว้ถูก Archive แล้ว กรุณาเลือกหมวดหมู่ใหม่ก่อนบันทึก");
    }
  }

  // "บันทึกรายการ" from a Recurring occurrence (docs/FINANCE.md Phase
  // G). Mutually exclusive with templateId in practice — the occurrence
  // (if present and valid) takes priority. The occurrence and its rule
  // are re-loaded and re-validated server-side; nothing about the
  // actual prefill values travels through the URL. An occurrence that
  // is no longer UPCOMING (already posted/skipped concurrently), whose
  // type doesn't match `?type=`, or that belongs to a different owner/
  // household than this Wallet, is ignored outright rather than trusted.
  const occurrence = occurrenceId ? await getOccurrence(supabase, occurrenceId) : null;
  const occurrenceApplies =
    occurrence &&
    occurrence.status === "UPCOMING" &&
    occurrence.transactionType === transactionType &&
    (occurrence.scope === "PERSONAL" ? occurrence.ownerUserId === wallet.owner_user_id : occurrence.householdId === wallet.household_id);

  if (occurrenceApplies && occurrence) {
    if (occurrence.pocketId && occurrence.pocketArchived) {
      staleNotices.push("Pocket ที่บันทึกไว้ถูก Archive แล้ว กรุณาเลือก Pocket ใหม่ก่อนบันทึก");
    }
    if (occurrence.categoryId && occurrence.categoryArchived) {
      staleNotices.push("หมวดหมู่ที่บันทึกไว้ถูก Archive แล้ว กรุณาเลือกหมวดหมู่ใหม่ก่อนบันทึก");
    }
  }

  return (
    <div className="finance-scope -mx-4 flex flex-col gap-4 px-4 pb-8">
      <PageHeader title={transactionType === "INCOME" ? "เพิ่มรายรับ" : "เพิ่มรายจ่าย"} backHref={`/wallets/${walletId}`} />
      <TransactionForm
        walletId={walletId}
        wallets={wallets.map(({ id, name, currency, scope }) => ({ id, name, currency, scope }))}
        transactionType={transactionType}
        pockets={pockets}
        categories={buildCategoryTree(categories)}
        tags={tags}
        returnTo={safeReturnTo}
        defaultAmount={occurrenceApplies ? occurrence!.amount : templateApplies ? template!.amount : undefined}
        defaultPocketId={
          occurrenceApplies && !occurrence!.pocketArchived
            ? occurrence!.pocketId
            : templateApplies && !template!.pocketArchived
              ? template!.pocketId
              : undefined
        }
        defaultCategoryId={
          occurrenceApplies && !occurrence!.categoryArchived
            ? occurrence!.categoryId
            : templateApplies && !template!.categoryArchived
              ? template!.categoryId
              : undefined
        }
        defaultCategoryLabel={
          occurrenceApplies && !occurrence!.categoryArchived
            ? occurrence!.categoryName
            : templateApplies && !template!.categoryArchived
              ? template!.categoryName
              : undefined
        }
        defaultTitle={occurrenceApplies ? occurrence!.title : templateApplies ? template!.title : undefined}
        defaultNote={occurrenceApplies ? occurrence!.note : templateApplies ? template!.note : undefined}
        defaultTagIds={
          occurrenceApplies
            ? occurrence!.tags.filter((t) => !t.archivedAt)
            : templateApplies
              ? template!.tags.filter((t) => !t.archivedAt)
              : undefined
        }
        staleNotices={staleNotices.length > 0 ? staleNotices : undefined}
        postOccurrence={occurrenceApplies ? { occurrenceId: occurrence!.occurrenceId, dueDate: occurrence!.dueDate } : undefined}
        templateId={templateApplies ? templateId : undefined}
        occurrenceId={occurrenceApplies ? occurrenceId : undefined}
        householdExpenseContext={householdExpenseContext}
      />
    </div>
  );
}
