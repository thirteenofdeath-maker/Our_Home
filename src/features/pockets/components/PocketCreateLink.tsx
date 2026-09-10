import Link from "next/link";

import { buttonClassName } from "@/components/ui/Button";

export function PocketCreateLink({ walletId }: { walletId: string }) {
  return (
    <Link href={`/wallets/${walletId}/pockets/new`} className={buttonClassName("secondary", "md", "w-auto px-3")}>
      + เพิ่ม Pocket
    </Link>
  );
}
