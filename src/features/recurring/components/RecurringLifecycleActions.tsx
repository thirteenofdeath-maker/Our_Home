import { ActionButton } from "@/components/ui/ActionButton";
import { buttonClassName } from "@/components/ui/Button";

import { archiveRecurringAction, pauseRecurringAction, resumeRecurringAction, restoreRecurringAction } from "../actions";
import type { RecurringSummary } from "../types";

/**
 * Pause/Resume/Archive/Restore for a rule. Pause and Archive are plain
 * table flips with no failure mode a user could hit (docs/FINANCE.md
 * Phase G "Pause"/"Archive") so they stay simple forms, matching
 * ArchiveBudgetForm/ArchiveTemplateForm. Resume and Restore can
 * genuinely fail (the reactivation trigger's generation call could
 * raise) so they use ActionButton to surface that.
 */
export function RecurringLifecycleActions({ rule }: { rule: RecurringSummary }) {
  if (rule.archivedAt) {
    return <ActionButton action={restoreRecurringAction} hiddenFields={{ id: rule.recurringId }} label="กู้คืน" />;
  }

  if (rule.pausedAt) {
    return (
      <div className="flex gap-2">
        <ActionButton action={resumeRecurringAction} hiddenFields={{ id: rule.recurringId }} label="เปิดใช้งานอีกครั้ง" />
        <form action={archiveRecurringAction}>
          <input type="hidden" name="id" value={rule.recurringId} />
          <button type="submit" className={buttonClassName("secondary", "md", "text-danger")}>
            เก็บถาวร
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <form action={pauseRecurringAction}>
        <input type="hidden" name="id" value={rule.recurringId} />
        <button type="submit" className={buttonClassName("secondary", "md")}>
          หยุดชั่วคราว
        </button>
      </form>
      <form action={archiveRecurringAction}>
        <input type="hidden" name="id" value={rule.recurringId} />
        <button type="submit" className={buttonClassName("secondary", "md", "text-danger")}>
          เก็บถาวร
        </button>
      </form>
    </div>
  );
}
