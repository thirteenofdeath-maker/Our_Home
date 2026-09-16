import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getMyPrimaryHousehold } from "@/features/household/api";
import {
  archivePlanNoteAction,
  pinPlanNoteAction,
} from "@/features/plan/actions";
import { getPlanNote } from "@/features/plan/api";
import { NoteForm } from "@/features/plan/components/NoteForm";
import { noteColorClass } from "@/features/plan/domain";
import { requireUser } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils/cn";

export default async function PlanNotePage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  const { supabase, user } = await requireUser();
  const note = await getPlanNote(supabase, noteId);
  if (!note) notFound();
  const household = await getMyPrimaryHousehold(supabase, user.id);
  return (
    <div className="finance-scope -mx-4 -mt-2 flex min-w-0 flex-col gap-4 px-4 pb-8 pt-2">
      <PageHeader title="รายละเอียดโน้ต" backHref="/calendar?view=notes" />
      <Card
        className={cn(
          "rounded-[1.5rem] border border-finance-primary-soft/60 text-finance-text",
          noteColorClass[note.color],
        )}
      >
        <p className="text-xs text-finance-muted">
          {note.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}
          {note.pinned_at ? " · ปักหมุด" : ""}
        </p>
        <h1 className="mt-2 text-xl font-semibold text-finance-text">
          {note.title || "ไม่มีหัวข้อ"}
        </h1>
        {note.content ? (
          <p className="mt-3 whitespace-pre-wrap text-sm">{note.content}</p>
        ) : null}
      </Card>
      <Card className="rounded-[1.25rem] bg-finance-surface-strong">
        <h2 className="mb-4 font-semibold text-finance-text">แก้ไขโน้ต</h2>
        <NoteForm note={note} hasHousehold={Boolean(household)} />
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <form action={pinPlanNoteAction}>
          <input type="hidden" name="noteId" value={note.id} />
          <input type="hidden" name="pinned" value={String(!note.pinned_at)} />
          <Button type="submit" variant="secondary">
            {note.pinned_at ? "เลิกปักหมุด" : "ปักหมุด"}
          </Button>
        </form>
        <form action={archivePlanNoteAction}>
          <input type="hidden" name="noteId" value={note.id} />
          <input
            type="hidden"
            name="archived"
            value={String(!note.archived_at)}
          />
          <Button type="submit" variant="ghost">
            {note.archived_at ? "นำออกจากคลัง" : "เก็บเข้าคลัง"}
          </Button>
        </form>
      </div>
    </div>
  );
}
