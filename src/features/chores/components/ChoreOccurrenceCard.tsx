import { ActionForm } from "@/components/ui/ActionForm";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { HouseholdMemberWithProfile } from "@/features/household/types";
import { claimChoreAction, completeChoreAction } from "../actions";
import type { ChoreOccurrence, ChoreTemplate } from "../types";

function memberName(members: HouseholdMemberWithProfile[], memberId: string) {
  const member = members.find((item) => item.id === memberId);
  return member?.profile?.display_name ?? member?.profile?.email ?? "สมาชิก";
}

export function ChoreOccurrenceCard({
  occurrence,
  template,
  members,
  currentMemberId,
  canParticipate,
  showDate = true,
}: {
  occurrence: ChoreOccurrence;
  template: ChoreTemplate;
  members: HouseholdMemberWithProfile[];
  currentMemberId: string | null;
  canParticipate: boolean;
  showDate?: boolean;
}) {
  const cleared = occurrence.completion_kind === "CLEARED";
  const resolvedBy = members.find(
    (member) => member.user_id === occurrence.completed_by,
  );
  const resolvedName =
    resolvedBy?.profile?.display_name ?? resolvedBy?.profile?.email ?? "สมาชิก";
  const completed = Boolean(occurrence.completed_at);
  const assignedName = memberName(members, occurrence.assigned_member_id);
  const wasTakenOver =
    occurrence.original_assigned_member_id !== occurrence.assigned_member_id;

  return (
    <Card
      className={`rounded-[1.35rem] ${completed ? "bg-primary-soft/35" : "bg-surface"}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full text-lg ${completed ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary-strong"}`}
        >
          {cleared ? "–" : completed ? "✓" : "•"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{template.title}</h3>
              <p className="mt-0.5 text-sm text-foreground-muted">
                {showDate
                  ? new Intl.DateTimeFormat("th-TH", {
                      dateStyle: "medium",
                    }).format(new Date(`${occurrence.due_date}T12:00:00+07:00`))
                  : null}
                {showDate && template.due_time ? " · " : null}
                {template.due_time
                  ? `${template.due_time.slice(0, 5)} น.`
                  : showDate
                    ? null
                    : "ทั้งวัน"}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-strong">
              {assignedName}
            </span>
          </div>
          {template.details ? (
            <p className="mt-2 text-sm text-foreground-muted">
              {template.details}
            </p>
          ) : null}
          {wasTakenOver ? (
            <p className="mt-2 text-xs text-foreground-muted">
              รับงานแทน{" "}
              {memberName(members, occurrence.original_assigned_member_id)}
            </p>
          ) : null}
          {!completed && canParticipate ? (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border/70 pt-3 text-sm font-medium">
              {occurrence.assigned_member_id !== currentMemberId ? (
                <ActionForm action={claimChoreAction}>
                  <input
                    type="hidden"
                    name="occurrenceId"
                    value={occurrence.id}
                  />
                  <SubmitButton
                    variant="secondary"
                    className="w-auto rounded-full border border-primary/20 px-4"
                  >
                    รับงานแทน
                  </SubmitButton>
                </ActionForm>
              ) : null}
              <ActionForm action={completeChoreAction}>
                <input
                  type="hidden"
                  name="occurrenceId"
                  value={occurrence.id}
                />
                <SubmitButton className="w-auto rounded-full px-4">
                  <span aria-hidden="true">✓</span>
                  ทำเสร็จแล้ว
                </SubmitButton>
              </ActionForm>
            </div>
          ) : null}
          {completed ? (
            <p className="mt-2 text-xs font-medium text-primary">
              {cleared ? "เคลียร์งานค้างโดย" : "เสร็จโดย"} {resolvedName}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
