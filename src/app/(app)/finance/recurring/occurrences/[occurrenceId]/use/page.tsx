import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getOccurrence } from "@/features/recurring/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Intermediate step reached only when an occurrence's saved Wallet
 * default is missing/archived, or the rule never had one (docs/
 * FINANCE.md Phase G "Optional references" — a stale/absent default is
 * never silently redirected). Lets the user pick an active Wallet in
 * the rule's own scope, then hands off to the EXISTING /wallets/
 * [walletId]/transactions/new flow with ?occurrenceId= — no second
 * transaction-writing implementation.
 */
export default async function UseOccurrencePage({
  params,
}: {
  params: Promise<{ occurrenceId: string }>;
}) {
  const { occurrenceId } = await params;
  const { supabase } = await requireUser();

  const occurrence = await getOccurrence(supabase, occurrenceId);
  if (!occurrence) notFound();
  if (occurrence.status !== "UPCOMING") notFound();

  const allWallets = await listMyWallets(supabase);
  const eligibleWallets = allWallets.filter(
    (w) => w.scope === occurrence.scope && (occurrence.scope === "PERSONAL" ? w.owner_user_id === occurrence.ownerUserId : w.household_id === occurrence.householdId),
  );

  if (eligibleWallets.length === 0) {
    return (
      <EmptyState
        title="ยังไม่มีกระเป๋าเงินที่ใช้ได้"
        description="เพิ่มกระเป๋าเงินก่อนบันทึกรายการนี้"
        action={
          <Link href="/wallets/new" className={buttonClassName("primary", "md")}>
            เพิ่มกระเป๋าเงิน
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">เลือกกระเป๋าเงินสำหรับ &ldquo;{occurrence.name}&rdquo;</h1>
      <p className="text-sm text-foreground-muted">
        {occurrence.walletId ? "Wallet ที่บันทึกไว้ถูกเก็บถาวรแล้ว กรุณาเลือก Wallet อื่น" : "รายการประจำนี้ไม่ได้บันทึก Wallet ไว้ล่วงหน้า"}
      </p>
      <div className="flex flex-col gap-2">
        {eligibleWallets.map((wallet) => (
          <Link key={wallet.id} href={`/wallets/${wallet.id}/transactions/new?type=${occurrence.transactionType}&occurrenceId=${occurrenceId}`}>
            <Card className="flex items-center justify-between">
              <span className="font-medium">{wallet.name}</span>
              <span className="text-xs text-foreground-muted">{wallet.currency}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
