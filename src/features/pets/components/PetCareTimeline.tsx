import Link from "next/link";

import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import { archivePetCareRecordAction } from "../actions";
import { PET_CARE_RECORD_LABEL, petCareDateLabel } from "../domain/care-record";
import type { PetCareRecordWithDocument } from "../types";

export function PetCareTimeline({
  petId,
  records,
}: {
  petId: string;
  records: PetCareRecordWithDocument[];
}) {
  if (!records.length) {
    return <Card className="rounded-[1.25rem] bg-finance-surface-strong"><p className="text-sm text-finance-muted">ยังไม่มีประวัติสุขภาพหรือตารางดูแล</p></Card>;
  }
  return (
    <div className="flex flex-col gap-3">
      {records.map((record) => (
        <Card key={record.id} className="rounded-[1.25rem] bg-finance-surface-strong">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex rounded-full bg-finance-primary-soft px-2.5 py-1 text-xs font-medium text-finance-primary-strong">
                {PET_CARE_RECORD_LABEL[record.record_type]}
              </span>
              <h3 className="mt-2 font-semibold text-finance-text">{record.title}</h3>
              <p className="text-sm text-finance-muted">บันทึก {petCareDateLabel(record.recorded_at)}</p>
            </div>
            {record.record_type === "WEIGHT" ? (
              <p className="shrink-0 text-lg font-semibold text-finance-primary-strong">{record.value} {record.unit}</p>
            ) : null}
          </div>
          {record.note ? <p className="mt-3 whitespace-pre-wrap text-sm text-finance-text">{record.note}</p> : null}
          {record.provider ? <p className="mt-2 text-sm text-finance-muted">สถานที่: {record.provider}</p> : null}
          {record.scheduled_at ? <p className="mt-2 text-sm font-medium text-finance-primary-strong">ครั้งถัดไป {petCareDateLabel(record.scheduled_at)}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {record.transaction_id ? <Link className={buttonClassName("secondary", "md", "w-auto")} href={`/finance/transactions/${record.transaction_id}`}>ดูรายการการเงิน</Link> : null}
            {record.documentUrl ? <a className={buttonClassName("secondary", "md", "w-auto")} href={record.documentUrl} target="_blank" rel="noreferrer">เปิดเอกสาร</a> : null}
            <form action={archivePetCareRecordAction}>
              <input type="hidden" name="recordId" value={record.id} />
              <input type="hidden" name="petId" value={petId} />
              <button type="submit" className={buttonClassName("ghost", "md", "w-auto text-finance-muted")}>เก็บเข้าคลัง</button>
            </form>
          </div>
        </Card>
      ))}
    </div>
  );
}
