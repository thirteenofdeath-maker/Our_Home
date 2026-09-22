import { PageHeader } from "@/components/shared/PageHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { Card } from "@/components/ui/Card";

const choices = [
  {
    scope: "all",
    title: "ทุกปฏิทิน",
    detail: "กิจกรรมส่วนตัวและของบ้าน รวมงาน รายการเตือน และวันเกิดที่แชร์",
  },
  {
    scope: "household",
    title: "เฉพาะของบ้าน",
    detail: "ข้อมูลที่แชร์กับบ้านและวันเกิดตามสิทธิ์ของนาย",
  },
  {
    scope: "personal",
    title: "เฉพาะส่วนตัว",
    detail: "เฉพาะกิจกรรม งาน และรายการเตือนส่วนตัวของนาย",
  },
] as const;

export default function CalendarExportPage() {
  return (
    <div className="finance-scope flex min-w-0 flex-col gap-5 pb-8">
      <PageHeader title="ส่งออกปฏิทิน" backHref="/calendar" />
      <section className="rounded-[1.65rem] bg-[linear-gradient(145deg,#eef4e9,#fff9ef_60%,#f7e4dc)] p-5 shadow-card">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-white/85 text-finance-primary-strong">
            <AppIcon name="calendar" className="size-7" />
          </span>
          <div>
            <p className="text-xs font-medium text-finance-primary-strong">
              Apple · Google · Outlook
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-finance-text">
              พกแผนของบ้านไปด้วย
            </h1>
            <p className="mt-1 text-sm text-finance-muted">
              ดาวน์โหลดไฟล์ .ics มาตรฐาน แล้วนำเข้าแอปปฏิทินที่ใช้
            </p>
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        {choices.map((choice) => (
          <Card
            key={choice.scope}
            className="rounded-[1.3rem] bg-finance-surface-strong"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-finance-text">
                  {choice.title}
                </h2>
                <p className="mt-1 text-sm text-finance-muted">
                  {choice.detail}
                </p>
              </div>
              <a
                href={`/calendar/export/download?scope=${choice.scope}`}
                download
                className="shrink-0 rounded-full bg-finance-primary px-4 py-2.5 text-sm font-medium text-white"
              >
                ดาวน์โหลด
              </a>
            </div>
          </Card>
        ))}
      </section>
      <Card className="rounded-[1.3rem] bg-finance-primary-soft/45">
        <h2 className="font-semibold text-finance-text">วิธีนำเข้า</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-finance-muted">
          <li>ดาวน์โหลดไฟล์ที่ต้องการ</li>
          <li>Apple Calendar: แตะไฟล์แล้วเลือกเพิ่มทั้งหมด</li>
          <li>
            Google Calendar: เปิดบนเว็บ ไปที่ Settings → Import & export →
            Import
          </li>
        </ol>
        <p className="mt-3 text-xs text-finance-muted">
          ไฟล์เป็นภาพข้อมูล ณ เวลาที่ดาวน์โหลด
          หากข้อมูลเปลี่ยนให้ดาวน์โหลดและนำเข้าใหม่
          ข้อมูลส่วนตัวและวันเกิดยังคงถูกจำกัดตามสิทธิ์เดิม
        </p>
      </Card>
    </div>
  );
}
