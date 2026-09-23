import type { ReactNode } from "react";

import { requireUser } from "@/lib/auth/require-user";
import { GlobalQuickAdd } from "@/components/shared/GlobalQuickAdd";
import { AppShell } from "@/components/shared/AppShell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireUser();

  return <AppShell financeQuickAdd={<GlobalQuickAdd />}>{children}</AppShell>;
}
