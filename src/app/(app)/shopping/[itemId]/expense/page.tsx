import { redirect } from "next/navigation";

export default async function ShoppingExpensePage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  redirect(`/shopping/expense?item=${encodeURIComponent(itemId)}`);
}
