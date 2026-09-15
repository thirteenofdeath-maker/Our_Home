import Link from "next/link";

import { cn } from "@/lib/utils/cn";
import { noteColorClass } from "../domain";
import type { PlanNote } from "../types";

export function NoteGrid({ notes }: { notes: PlanNote[] }) {
  if (!notes.length) {
    return <div className="rounded-card bg-surface p-4 text-sm text-foreground-muted shadow-card">ยังไม่มีโน้ตในมุมมองนี้</div>;
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {notes.map((note) => (
        <Link
          key={note.id}
          href={`/calendar/notes/${note.id}`}
          className={cn("min-w-0 rounded-card border border-border/50 p-4 shadow-sm", noteColorClass[note.color])}
        >
          <div className="flex items-start justify-between gap-2">
            <h2 className="line-clamp-2 font-semibold">{note.title || "ไม่มีหัวข้อ"}</h2>
            {note.pinned_at ? <span aria-label="ปักหมุดแล้ว" className="shrink-0 text-xs">●</span> : null}
          </div>
          {note.content ? <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm text-foreground-muted">{note.content}</p> : null}
          <p className="mt-3 text-[10px] text-foreground-muted">{note.scope === "PERSONAL" ? "ส่วนตัว" : "ครอบครัว"}</p>
        </Link>
      ))}
    </div>
  );
}
