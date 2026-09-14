import type { ReactNode } from "react";
import Link from "next/link";

import { getAvatarDisplayUrl, getCurrentProfile } from "@/features/profile/api";
import { Avatar } from "@/features/profile/components/Avatar";
import { requireUser } from "@/lib/auth/require-user";
import { listMyWallets } from "@/features/wallets/api";
import { GlobalQuickAdd } from "@/components/shared/GlobalQuickAdd";
import { AppShell } from "@/components/shared/AppShell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await requireUser();
  const [profile,wallets] = await Promise.all([getCurrentProfile(supabase, user.id),listMyWallets(supabase)]);
  const avatarUrl = await getAvatarDisplayUrl(supabase, profile?.avatar_url ?? null);

  const globalHeader = (
      <header className="bg-background px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">Our Home</span>
          {profile ? <Link className="flex size-11 items-center justify-center" href="/profile/edit" aria-label="แก้ไขโปรไฟล์"><Avatar displayName={profile.display_name} url={avatarUrl} color="var(--color-primary)" /></Link> : null}
        </div>
      </header>
  );

  return <AppShell globalHeader={globalHeader} financeQuickAdd={<GlobalQuickAdd walletId={wallets[0]?.id ?? null} />}>{children}</AppShell>;
}
