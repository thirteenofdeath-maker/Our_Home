import { Card } from "@/components/ui/Card";

export function PlanSummary({
  today,
  eventCount,
  taskCount,
  noteCount,
}: {
  today: string;
  eventCount: number;
  taskCount: number;
  noteCount: number;
}) {
  const date = new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${today}T00:00:00Z`));
  return (
    <Card className="overflow-hidden bg-[linear-gradient(135deg,#e7efe3,#f8f2e8)] p-5">
      <p className="text-sm font-medium text-foreground-muted">วันนี้ · {date}</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <SummaryMetric value={eventCount} label="กิจกรรม" />
        <SummaryMetric value={taskCount} label="งานค้าง" />
        <SummaryMetric value={noteCount} label="โน้ต" />
      </div>
    </Card>
  );
}

function SummaryMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 rounded-[1rem] bg-white/75 px-2 py-3 text-center">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="truncate text-xs text-foreground-muted">{label}</p>
    </div>
  );
}
