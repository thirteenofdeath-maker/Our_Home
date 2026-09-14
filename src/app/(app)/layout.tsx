import type { ReactNode } from "react";
import Link from "next/link";

import { getAvatarDisplayUrl, getCurrentProfile } from "@/features/profile/api";
import { Avatar } from "@/features/profile/components/Avatar";
import { requireUser } from "@/lib/auth/require-user";
import { AppShell } from "@/components/shared/AppShell";
import { AppIcon } from "@/components/ui/AppIcon";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await requireUser();
  const profile = await getCurrentProfile(supabase, user.id);
  const avatarUrl = await getAvatarDisplayUrl(supabase, profile?.avatar_url ?? null);

  const globalHeader = (
      <header className="bg-[linear-gradient(180deg,#fbf7ef_0%,#fff_100%)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-[1.1rem] bg-[#e7f0df] text-[#56735e] shadow-sm"><AppIcon name="household" className="size-7" /></span>
            <span><span className="block text-xl font-bold tracking-tight text-[#352725]">Our Home</span><span className="block text-xs text-foreground-muted">บ้านเดียวกัน ดูแลได้ทุกวัน</span></span>
          </Link>
          {profile ? <Link className="flex size-11 items-center justify-center" href="/profile/edit" aria-label="แก้ไขโปรไฟล์"><Avatar displayName={profile.display_name} url={avatarUrl} color="var(--color-primary)" /></Link> : null}
        </div>
      </header>
  );

  return <AppShell globalHeader={globalHeader}>{children}</AppShell>;
}
