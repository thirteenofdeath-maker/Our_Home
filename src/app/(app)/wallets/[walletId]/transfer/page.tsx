import Link from "next/link";

import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default async function TransferChooserPage({
  params,
}: {
  params: Promise<{ walletId: string }>;
}) {
  const { walletId } = await params;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">โอนเงิน</h1>
      <Card className="flex flex-col gap-2">
        <h2 className="font-medium">ระหว่างช่องในกระเป๋านี้</h2>
        <p className="text-sm text-foreground-muted">ย้ายเงินระหว่างช่อง (Pocket) โดยยอดรวมกระเป๋าเงินไม่เปลี่ยนแปลง</p>
        <Link href={`/wallets/${walletId}/transfer/pocket`} className={buttonClassName("primary", "md")}>
          โอนระหว่างช่อง
        </Link>
      </Card>
      <Card className="flex flex-col gap-2">
        <h2 className="font-medium">ไปกระเป๋าเงินอื่น</h2>
        <p className="text-sm text-foreground-muted">ย้ายเงินไปยังกระเป๋าเงินอื่นของคุณ</p>
        <Link href={`/wallets/${walletId}/transfer/wallet`} className={buttonClassName("secondary", "md")}>
          โอนไปกระเป๋าเงินอื่น
        </Link>
      </Card>
    </div>
  );
}
