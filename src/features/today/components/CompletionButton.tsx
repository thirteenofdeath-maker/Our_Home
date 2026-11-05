import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { completeChoreAction } from "@/features/chores/actions";
import {
  togglePlanReminderAction,
  togglePlanTaskAction,
} from "@/features/plan/actions";

export type CompletionTarget = {
  kind: "chore" | "task" | "reminder";
  id: string;
};

const completionActions = {
  chore: { action: completeChoreAction, field: "occurrenceId" },
  task: { action: togglePlanTaskAction, field: "taskId" },
  reminder: { action: togglePlanReminderAction, field: "reminderId" },
};

export function CompletionButton({
  target,
  title,
}: {
  target: CompletionTarget;
  title: string;
}) {
  const { action, field } = completionActions[target.kind];
  return (
    <ActionForm action={action} className="shrink-0 max-w-28">
      <input type="hidden" name={field} value={target.id} />
      <input type="hidden" name="completed" value="true" />
      <SubmitButton
        variant="secondary"
        aria-label={`ทำเสร็จแล้ว: ${title}`}
        title="ทำเสร็จแล้ว"
        className="size-11 w-11 rounded-full border border-primary/30 p-0 text-lg"
      >
        <span aria-hidden="true">✓</span>
      </SubmitButton>
    </ActionForm>
  );
}
