import type { ReactNode } from "react";

import { BottomNav } from "@/components/shared/BottomNav";
import { getCurrentProfile } from "@/features/profile/api";
import { signOutAction } from "@/features/auth/actions";
import { requireUser } from "@/lib/auth/require-user";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await requireUser();
  const profile = await getCurrentProfile(supabase, user.id);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <span className="font-semibold">Our Home</span>
        <form action={signOutAction} className="flex items-center gap-2">
          <span className="text-sm text-foreground-muted">{profile?.display_name}</span>
          <button type="submit" className="text-sm font-medium text-primary">
            ออกจากระบบ
          </button>
        </form>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-6">{children}</main>
      <BottomNav />
    </div>
  );
}
