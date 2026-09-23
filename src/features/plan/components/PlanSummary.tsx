import { Card } from "@/components/ui/Card";

export function PlanSummary({
  today,
  eventCount,
  taskCount,
  reminderCount,
  noteCount,
}: {
  today: string;
  eventCount: number;
  taskCount: number;
  reminderCount: number;
  noteCount: number;
}) {
  const date = new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${today}T00:00:00Z`));
  return (
    <Card className="relative overflow-hidden rounded-[1.75rem] time-tinted-panel p-5 shadow-card">
      <div className="absolute -right-8 -top-10 size-32 rounded-full bg-white/45" />
      <p className="relative text-sm font-medium text-finance-muted">
        วันนี้ · {date}
      </p>
      <div className="relative mt-4 grid grid-cols-4 gap-2">
        <SummaryMetric value={eventCount} label="กิจกรรม" />
        <SummaryMetric value={taskCount} label="งานค้าง" />
        <SummaryMetric value={reminderCount} label="เตือน" />
        <SummaryMetric value={noteCount} label="โน้ต" />
      </div>
    </Card>
  );
}

function SummaryMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 rounded-[1.15rem] bg-white/75 px-2 py-3 text-center backdrop-blur-sm">
      <p className="text-xl font-semibold tabular-nums text-finance-text">
        {value}
      </p>
      <p className="truncate text-xs text-finance-muted">{label}</p>
    </div>
  );
}
