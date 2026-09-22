export type PreferenceCandidate = {
  sourceType: string;
  kind: string;
  category: string;
  preferenceKey?: string;
};

export function notificationPreferenceAllows(
  candidate: PreferenceCandidate,
  preference: Record<string, boolean>,
) {
  const categoryEnabled = candidate.preferenceKey
    ? preference[candidate.preferenceKey]
    : preference[`${candidate.category}_enabled`];
  if (!categoryEnabled) return false;

  const isBirthday =
    candidate.sourceType === "MEMBER_BIRTHDAY" ||
    candidate.sourceType === "PET_BIRTHDAY";
  if (
    isBirthday &&
    candidate.kind === "WEEK_BEFORE" &&
    !preference.birthday_week_before_enabled
  )
    return false;
  if (candidate.kind === "DAY_BEFORE" && !preference.day_before_enabled)
    return false;
  if (candidate.kind === "DUE_DAY" && !preference.due_day_enabled) return false;
  return true;
}
