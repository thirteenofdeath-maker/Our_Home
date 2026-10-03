import type { ReactNode } from "react";

import { requireUser } from "@/lib/auth/require-user";
import { AppShell } from "@/components/shared/AppShell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireUser();

  return <AppShell>{children}</AppShell>;
}
