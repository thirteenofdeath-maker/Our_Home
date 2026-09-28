import { redirect } from "next/navigation";

export default function InventoryPage() {
  redirect("/calendar?view=inventory");
}
