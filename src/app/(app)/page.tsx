import { redirect } from "next/navigation";

import { getMyPrimaryHousehold } from "@/features/household/api";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

export default async function HomePage() {
  const { supabase, user } = await requireUser();

  const [wallets, household] = await Promise.all([
    listMyWallets(supabase),
    getMyPrimaryHousehold(supabase, user.id),
  ]);

  if (wallets.length === 0 && !household) {
    redirect("/onboarding");
  }

  redirect("/wallets");
}
