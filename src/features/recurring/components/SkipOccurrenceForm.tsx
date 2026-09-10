import { ActionButton } from "@/components/ui/ActionButton";

import { skipOccurrenceAction } from "../actions";

export function SkipOccurrenceForm({ occurrenceId, recurringId }: { occurrenceId: string; recurringId: string }) {
  return (
    <ActionButton
      action={skipOccurrenceAction}
      hiddenFields={{ occurrenceId, recurringId }}
      label="ข้ามรายการนี้"
      variant="secondary"
      className="w-auto px-3"
    />
  );
}
