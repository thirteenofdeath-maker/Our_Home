export type BirthdaySource = {
  subject_type: "MEMBER" | "PET";
  subject_id: string;
  display_name: string;
  month_day: string;
  personal?: boolean;
};

export type CalendarBirthday = BirthdaySource & {
  key: string;
  date: string;
  href: string;
};

export function birthdayDateInYear(monthDay: string, year: number) {
  if (!/^\d{2}-\d{2}$/.test(monthDay)) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const observed = monthDay === "02-29" && !leap ? "02-28" : monthDay;
  const date = `${year}-${observed}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
    ? date
    : null;
}

export function withOwnBirthday(
  shared: BirthdaySource[],
  profile: { birthday: string | null; display_name: string } | null,
  userId: string,
): BirthdaySource[] {
  if (
    !profile?.birthday ||
    shared.some(
      (item) => item.subject_type === "MEMBER" && item.subject_id === userId,
    )
  )
    return shared;
  return [
    ...shared,
    {
      subject_type: "MEMBER",
      subject_id: userId,
      display_name: profile.display_name,
      month_day: profile.birthday.slice(5),
      personal: true,
    },
  ];
}

/** Read-model occurrences: never insert calendar_events or expose birth years. */
export function birthdayOccurrences(
  sources: BirthdaySource[],
  from: string,
  to: string,
): CalendarBirthday[] {
  const occurrences = new Map<string, CalendarBirthday>();
  for (
    let year = Number(from.slice(0, 4));
    year <= Number(to.slice(0, 4));
    year++
  ) {
    for (const source of sources) {
      const date = birthdayDateInYear(source.month_day, year);
      if (!date || date < from || date >= to) continue;
      const key = `birthday-${source.subject_type}-${source.subject_id}-${date}`;
      occurrences.set(key, {
        ...source,
        key,
        date,
        href:
          source.subject_type === "PET"
            ? `/pets/${source.subject_id}`
            : source.personal
              ? "/profile/edit"
              : "/household/members",
      });
    }
  }
  return [...occurrences.values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.subject_type === b.subject_type
        ? a.display_name.localeCompare(b.display_name, "th")
        : a.subject_type === "MEMBER"
          ? -1
          : 1),
  );
}

export function birthdayGreeting(birthdays: CalendarBirthday[]) {
  return `สุขสันต์วันเกิด ${birthdays.map((item) => item.display_name).join(" และ ")} 🎉`;
}
