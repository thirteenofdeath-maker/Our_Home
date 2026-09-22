export type BirthdayNotificationKind =
  | "WEEK_BEFORE"
  | "DAY_BEFORE"
  | "DUE_DAY";

export type BirthdayOccurrence = {
  kind: BirthdayNotificationKind;
  occurrenceDate: string;
};

export type BirthdayMember = {
  id: string;
  household_id: string;
  user_id: string;
  role: string;
};

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function anniversaryInYear(birthday: string, year: number) {
  const monthDay = birthday.slice(5);
  return monthDay === "02-29" && !isLeapYear(year)
    ? `${year}-02-28`
    : `${year}-${monthDay}`;
}

function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

export function birthdayOccurrence(
  birthday: string | null,
  today: string,
): BirthdayOccurrence | null {
  if (!birthday) return null;
  const year = Number(today.slice(0, 4));
  let occurrenceDate = anniversaryInYear(birthday, year);
  if (occurrenceDate < today)
    occurrenceDate = anniversaryInYear(birthday, year + 1);
  const days = daysBetween(today, occurrenceDate);
  if (days === 7) return { kind: "WEEK_BEFORE", occurrenceDate };
  if (days === 1) return { kind: "DAY_BEFORE", occurrenceDate };
  if (days === 0) return { kind: "DUE_DAY", occurrenceDate };
  return null;
}

export function memberBirthdayRecipients(
  members: BirthdayMember[],
  birthdayUserId: string,
) {
  const householdIds = new Set(
    members
      .filter(
        (member) =>
          member.user_id === birthdayUserId && member.role !== "observer",
      )
      .map((member) => member.household_id),
  );
  return [...new Set(
    members
      .filter(
        (member) =>
          householdIds.has(member.household_id) &&
          member.role !== "observer" &&
          member.user_id !== birthdayUserId,
      )
      .map((member) => member.user_id),
  )];
}

export function petBirthdayRecipients(
  members: BirthdayMember[],
  householdId: string,
  caregiverMemberIds: Iterable<string>,
) {
  const caregivers = new Set(caregiverMemberIds);
  return [...new Set(
    members
      .filter(
        (member) =>
          member.household_id === householdId &&
          member.role !== "observer" &&
          (member.role === "owner" ||
            member.role === "admin" ||
            caregivers.has(member.id)),
      )
      .map((member) => member.user_id),
  )];
}
