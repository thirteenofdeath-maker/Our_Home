import { Card } from "@/components/ui/Card";
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
}: {
  occurrence: ChoreOccurrence;
  template: ChoreTemplate;
  members: HouseholdMemberWithProfile[];
  currentMemberId: string | null;
  canParticipate: boolean;
}) {
  const completed = Boolean(occurrence.completed_at);
  const assignedName = memberName(members, occurrence.assigned_member_id);
  const wasTakenOver = occurrence.original_assigned_member_id !== occurrence.assigned_member_id;

  return (
    <Card className={`rounded-[1.35rem] ${completed ? "bg-primary-soft/35" : "bg-surface"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-lg ${completed ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary"}`}>
          {completed ? "✓" : "•"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{template.title}</h3>
              <p className="mt-0.5 text-sm text-foreground-muted">
                {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date(`${occurrence.due_date}T12:00:00+07:00`))}
                {template.due_time ? ` · ${template.due_time.slice(0, 5)} น.` : ""}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
              {assignedName}
            </span>
          </div>
          {template.details ? <p className="mt-2 text-sm text-foreground-muted">{template.details}</p> : null}
          {wasTakenOver ? (
            <p className="mt-2 text-xs text-foreground-muted">
              รับงานแทน {memberName(members, occurrence.original_assigned_member_id)}
            </p>
          ) : null}
          {!completed && canParticipate ? (
            <div className="mt-3 flex gap-3 border-t border-border/70 pt-3 text-sm font-medium">
              {occurrence.assigned_member_id !== currentMemberId ? (
                <form action={claimChoreAction}>
                  <input type="hidden" name="occurrenceId" value={occurrence.id} />
                  <button type="submit" className="text-primary">รับงานแทน</button>
                </form>
              ) : null}
              <form action={completeChoreAction}>
                <input type="hidden" name="occurrenceId" value={occurrence.id} />
                <button type="submit" className="text-primary">ทำเสร็จแล้ว</button>
              </form>
            </div>
          ) : null}
          {completed ? <p className="mt-2 text-xs font-medium text-primary">เสร็จโดย {assignedName}</p> : null}
        </div>
      </div>
    </Card>
  );
}

