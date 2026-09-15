import type { ReactNode } from "react";

import { requireUser } from "@/lib/auth/require-user";
import { listMyWallets } from "@/features/wallets/api";
import { GlobalQuickAdd } from "@/components/shared/GlobalQuickAdd";
import { AppShell } from "@/components/shared/AppShell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { supabase } = await requireUser();
  const wallets = await listMyWallets(supabase);

  return (
    <AppShell
      financeQuickAdd={<GlobalQuickAdd walletId={wallets[0]?.id ?? null} />}
    >
      {children}
    </AppShell>
  );
}
