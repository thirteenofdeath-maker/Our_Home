export type DigestCountKey =
  "tasks" | "appointments" | "birthdays" | "bills" | "pets" | "inventory";

export type DigestCounts = Record<DigestCountKey, number>;
export type DigestDetails = Partial<Record<DigestCountKey, string[]>>;

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
      inventory: 0,
    };
    counts[key] += 1;
    countsByUser.set(userId, counts);
  }
}

export function addDigestDetail(
  detailsByUser: Map<string, DigestDetails>,
  userIds: Iterable<string>,
  key: DigestCountKey,
  detail: string,
) {
  for (const userId of new Set(userIds)) {
    if (!userId || !detail) continue;
    const details = detailsByUser.get(userId) ?? {};
    details[key] = [...new Set([...(details[key] ?? []), detail])];
    detailsByUser.set(userId, details);
  }
}

export function digestBody(
  counts: DigestCounts,
  period: "DAILY" | "WEEKLY",
  details: DigestDetails = {},
) {
  const labels: Array<[DigestCountKey, string, string]> = [
    ["tasks", "งาน", "งาน"],
    ["appointments", "นัดหมาย", "นัดหมาย"],
    ["birthdays", "วันเกิด", "วันเกิด"],
    ["bills", "บิล", "บิล"],
    ["pets", "รายการสัตว์เลี้ยง", "สัตว์เลี้ยง"],
    ["inventory", "รายการคลังของ", "คลังของ"],
  ];
  const parts = labels
    .filter(([key]) => counts[key] > 0)
    .map(([key, countLabel, detailLabel]) => {
      const firstDetail = details[key]?.[0];
      if (!firstDetail) return `${counts[key]} ${countLabel}`;
      const remaining = Math.max(0, counts[key] - 1);
      return `${detailLabel}: ${firstDetail}${remaining ? ` และอีก ${remaining} รายการ` : ""}`;
    });
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
