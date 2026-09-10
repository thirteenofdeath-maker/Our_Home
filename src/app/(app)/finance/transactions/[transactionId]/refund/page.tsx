import { CreateAdjustmentPage } from "@/features/refunds/components/CreateAdjustmentPage";

export default async function RefundPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;
  return <CreateAdjustmentPage transactionId={transactionId} kind="REFUND" />;
}
