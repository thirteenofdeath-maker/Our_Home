export function initialAssigneeOrder(
  members: Array<{ id: string }>,
  selectedMemberIds?: string[],
) {
  const knownMemberIds = new Set(members.map((member) => member.id));
  const initialIds = selectedMemberIds ?? members.map((member) => member.id);
  return [...new Set(initialIds)].filter((id) => knownMemberIds.has(id));
}

export function moveAssignee(
  memberIds: string[],
  memberId: string,
  direction: -1 | 1,
) {
  const currentIndex = memberIds.indexOf(memberId);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= memberIds.length) {
    return memberIds;
  }
  const next = [...memberIds];
  [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
  return next;
}

export function toggleAssignee(
  memberIds: string[],
  memberId: string,
  selected: boolean,
) {
  if (selected) {
    return memberIds.includes(memberId) ? memberIds : [...memberIds, memberId];
  }
  return memberIds.filter((id) => id !== memberId);
}
