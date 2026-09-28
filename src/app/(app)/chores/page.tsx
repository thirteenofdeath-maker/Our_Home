import { redirect } from "next/navigation";

export default function ChoresPage() {
  redirect("/calendar?view=chores");
}
