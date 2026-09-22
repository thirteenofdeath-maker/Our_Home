export type DigestCountKey =
  | "tasks"
  | "appointments"
  | "birthdays"
  | "bills"
  | "pets";

export type DigestCounts = Record<DigestCountKey, number>;

export function addDigestCount(
  countsByUser: Map<string, DigestCounts>,
  userIds: Iterable<string>,
  key: DigestCountKey,
) {
  for (const userId of new Set(userIds)) {
    if (!userId) continue;
    const counts = countsByUser.get(userId) ?? {
      tasks: 0,
      appointments: 0,
      birthdays: 0,
      bills: 0,
      pets: 0,
    };
    counts[key] += 1;
    countsByUser.set(userId, counts);
  }
}

export function digestBody(counts: DigestCounts, period: "DAILY" | "WEEKLY") {
  const labels: Array<[DigestCountKey, string]> = [
    ["tasks", "งาน"],
    ["appointments", "นัดหมาย"],
    ["birthdays", "วันเกิด"],
    ["bills", "บิล"],
    ["pets", "รายการสัตว์เลี้ยง"],
  ];
  const parts = labels
    .filter(([key]) => counts[key] > 0)
    .map(([key, label]) => `${counts[key]} ${label}`);
  if (parts.length) return parts.join(" · ");
  return period === "DAILY"
    ? "วันนี้ไม่มีรายการสำคัญ บ้านพร้อมแล้ว"
    : "สัปดาห์หน้ากำหนดการยังว่าง บ้านพร้อมวางแผนใหม่";
}

export function birthdayFallsInWindow(
  birthday: string | null,
  startDate: string,
  endDate: string,
) {
  if (!birthday) return false;
  const monthDay = birthday.slice(5);
  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  for (let year = startYear; year <= endYear; year++) {
    const occurrence = `${year}-${monthDay}`;
    if (occurrence >= startDate && occurrence <= endDate) return true;
  }
  return false;
}

