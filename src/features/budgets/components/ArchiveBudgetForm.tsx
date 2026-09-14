import { buttonClassName } from "@/components/ui/Button";
import { archiveBudgetAction } from "../actions";

export function ArchiveBudgetForm({ budgetId }: { budgetId: string }) {
  return (
    <form action={archiveBudgetAction}>
      <input type="hidden" name="id" value={budgetId} />
      <button type="submit" className={buttonClassName("secondary", "lg", "text-danger")}>
        เก็บถาวรงบประมาณ
      </button>
    </form>
  );
}
