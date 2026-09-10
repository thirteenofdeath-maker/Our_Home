import Link from "next/link";

export function PocketCreateLink({ walletId }: { walletId: string }) {
  return (
    <Link href={`/wallets/${walletId}/pockets/new`} className="flex min-h-11 items-center px-2 text-sm font-medium text-primary">
      + เพิ่ม
    </Link>
  );
}
