import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getTemplate } from "@/features/templates/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Intermediate step reached only when a Template's saved Wallet default
 * is missing or archived (see docs/FINANCE.md Phase F "Wallet/Pocket
 * rules" — a stale default is never silently redirected to another
 * Wallet). Lets the user pick an active Wallet in the Template's own
 * scope, then hands off to the EXISTING /wallets/[walletId]/transactions/new
 * flow with ?templateId= — no second transaction-writing implementation.
 */
export default async function UseTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const { supabase } = await requireUser();

  const template = await getTemplate(supabase, templateId);
  if (!template) notFound();
  if (template.archivedAt) notFound();

  const allWallets = await listMyWallets(supabase);
  const eligibleWallets = allWallets.filter(
    (w) => w.scope === template.scope && (template.scope === "PERSONAL" ? w.owner_user_id === template.ownerUserId : w.household_id === template.householdId),
  );

  if (eligibleWallets.length === 0) {
    return (
      <EmptyState
        title="ยังไม่มีกระเป๋าเงินที่ใช้ได้"
        description="เพิ่มกระเป๋าเงินก่อนใช้ Template นี้"
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
      <h1 className="text-xl font-semibold">เลือกกระเป๋าเงินสำหรับ &ldquo;{template.name}&rdquo;</h1>
      <p className="text-sm text-foreground-muted">
        {template.walletId ? "Wallet ที่บันทึกไว้ถูกเก็บถาวรแล้ว กรุณาเลือก Wallet อื่น" : "Template นี้ไม่ได้บันทึก Wallet ไว้ล่วงหน้า"}
      </p>
      <div className="flex flex-col gap-2">
        {eligibleWallets.map((wallet) => (
          <Link key={wallet.id} href={`/wallets/${wallet.id}/transactions/new?type=${template.transactionType}&templateId=${templateId}`}>
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
