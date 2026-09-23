import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { Card } from "@/components/ui/Card";
import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { listChoreWorkspace, materializeChores } from "@/features/chores/api";
import { toggleChoreTemplateAction } from "@/features/chores/actions";
import { ChoreForm } from "@/features/chores/components/ChoreForm";
import { ChoreOccurrenceCard } from "@/features/chores/components/ChoreOccurrenceCard";
import {
  getMyPrimaryHousehold,
  listHouseholdMembers,
} from "@/features/household/api";
import { requireUser } from "@/lib/auth/require-user";
import { bangkokDateKey, shiftDate } from "@/lib/date/bangkok";

export default async function ChoresPage() {
  const { supabase, user } = await requireUser();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  if (!household) {
    return (
      <div className="flex flex-col gap-4 pb-8">
        <PageHeader title="งานบ้าน" />
        <Card className="rounded-[1.5rem] text-center">
          <p className="font-medium">สร้างบ้านก่อนจัดตารางงานบ้าน</p>
          <Link
            className="mt-3 inline-block text-primary"
            href="/household/new"
          >
            สร้างบ้าน
          </Link>
        </Card>
      </div>
    );
  }

  const today = bangkokDateKey();
  const canParticipate = household.myRole !== "observer";
  const canManage =
    household.myRole === "owner" || household.myRole === "admin";
  if (canParticipate) {
    await materializeChores(supabase, household.id, shiftDate(today, 14));
  }
  const [workspace, members] = await Promise.all([
    listChoreWorkspace(supabase, household.id),
    listHouseholdMembers(supabase, household.id),
  ]);
  const currentMemberId =
    members.find((member) => member.user_id === user.id)?.id ?? null;
  const templates = new Map(
    workspace.templates.map((template) => [template.id, template]),
  );
  const upcoming = workspace.occurrences
    .filter((item) => !item.completed_at && item.due_date >= today)
    .toSorted((a, b) => a.due_date.localeCompare(b.due_date));
  const overdue = workspace.occurrences
    .filter((item) => !item.completed_at && item.due_date < today)
    .toSorted((a, b) => a.due_date.localeCompare(b.due_date));
  const history = workspace.occurrences
    .filter((item) => item.completed_at)
    .slice(0, 12);

  return (
    <div className="-mx-4 -mt-2 flex min-w-0 flex-col gap-5 px-4 pb-8 pt-3">
      <PageHeader title="งานบ้าน" />
      <section className="rounded-[1.65rem] time-tinted-panel p-5 shadow-card">
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/85 text-primary shadow-sm">
            <AppIcon name="chores" className="size-7" />
          </span>
          <div>
            <p className="text-xs font-medium text-primary">
              แบ่งกันทำ บ้านเบาขึ้น
            </p>
            <h1 className="mt-1 text-2xl font-semibold">งานบ้านหมุนเวียน</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              ค้าง {overdue.length} · กำลังจะถึง {upcoming.length} งาน
            </p>
          </div>
        </div>
      </section>

      {canManage ? (
        <FormSheetButton
          ariaLabel="เพิ่มตารางงานบ้าน"
          triggerClassName="app-fab fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-20 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_rgb(79_112_88_/_0.3)] transition-transform active:scale-95"
          sheetTitle="เพิ่มตารางงานบ้าน"
          form={
            <ChoreForm
              householdId={household.id}
              today={today}
              members={members.map((member) => ({
                id: member.id,
                label:
                  member.profile?.display_name ??
                  member.profile?.email ??
                  "สมาชิก",
              }))}
            />
          }
        >
          <AppIcon name="plus" />
        </FormSheetButton>
      ) : household.myRole === "observer" ? (
        <p className="rounded-[1rem] bg-primary-soft/60 px-4 py-3 text-sm text-foreground-muted">
          ผู้สังเกตการณ์ดูตารางและประวัติได้ แต่ไม่สามารถเปลี่ยนแปลงงานบ้าน
        </p>
      ) : null}

      {overdue.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-danger">เลยกำหนด</h2>
          {overdue.map((occurrence) => {
            const template = templates.get(occurrence.template_id);
            return template ? (
              <ChoreOccurrenceCard
                key={occurrence.id}
                occurrence={occurrence}
                template={template}
                members={members}
                currentMemberId={currentMemberId}
                canParticipate={canParticipate}
              />
            ) : null;
          })}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">งานถัดไป</h2>
          <span className="text-sm text-foreground-muted">14 วัน</span>
        </div>
        {upcoming.length ? (
          upcoming.map((occurrence) => {
            const template = templates.get(occurrence.template_id);
            return template ? (
              <ChoreOccurrenceCard
                key={occurrence.id}
                occurrence={occurrence}
                template={template}
                members={members}
                currentMemberId={currentMemberId}
                canParticipate={canParticipate}
              />
            ) : null;
          })
        ) : (
          <Card className="rounded-[1.35rem] text-center text-sm text-foreground-muted">
            ยังไม่มีตารางงานบ้าน
          </Card>
        )}
      </section>

      {canManage && workspace.templates.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">ตารางหมุนเวียน</h2>
          {workspace.templates.map((template) => {
            const templateAssignees = workspace.assignees.filter(
              (item) => item.template_id === template.id,
            );
            const assigneeCount = templateAssignees.length;
            return (
              <Card
                key={template.id}
                className="flex items-center justify-between gap-3 rounded-[1.35rem]"
              >
                <div>
                  <h3 className="font-semibold">{template.title}</h3>
                  <p className="mt-0.5 text-sm text-foreground-muted">
                    {template.cadence === "DAILY" ? "ทุกวัน" : "ทุกสัปดาห์"} ·{" "}
                    {assigneeCount} คน
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <FormSheetButton
                    ariaLabel={`แก้ไข ${template.title}`}
                    triggerClassName="rounded-full border border-border bg-surface px-3 py-2 text-sm font-medium text-primary"
                    sheetTitle="แก้ไขตารางงานบ้าน"
                    form={
                      <ChoreForm
                        householdId={household.id}
                        today={today}
                        members={members.map((member) => ({
                          id: member.id,
                          label:
                            member.profile?.display_name ??
                            member.profile?.email ??
                            "สมาชิก",
                        }))}
                        template={template}
                        selectedMemberIds={templateAssignees.map(
                          (item) => item.member_id,
                        )}
                      />
                    }
                  >
                    แก้ไข
                  </FormSheetButton>
                  <form action={toggleChoreTemplateAction}>
                    <input
                      type="hidden"
                      name="templateId"
                      value={template.id}
                    />
                    <input
                      type="hidden"
                      name="active"
                      value={String(!template.is_active)}
                    />
                    <button
                      type="submit"
                      className="rounded-full bg-primary-soft px-3 py-2 text-sm font-medium text-primary-strong"
                    >
                      {template.is_active ? "พักตาราง" : "เปิดตาราง"}
                    </button>
                  </form>
                </div>
              </Card>
            );
          })}
        </section>
      ) : null}

      {history.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">ประวัติล่าสุด</h2>
          {history.map((occurrence) => {
            const template = templates.get(occurrence.template_id);
            return template ? (
              <ChoreOccurrenceCard
                key={occurrence.id}
                occurrence={occurrence}
                template={template}
                members={members}
                currentMemberId={currentMemberId}
                canParticipate={canParticipate}
              />
            ) : null;
          })}
        </section>
      ) : null}
    </div>
  );
}
