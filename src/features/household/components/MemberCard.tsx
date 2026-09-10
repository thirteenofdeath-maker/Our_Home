import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { Avatar } from "@/features/profile/components/Avatar";
import type { HouseholdMemberWithProfile } from "@/features/household/types";

export const ROLE_LABEL = { owner: "เจ้าของ", admin: "ผู้ดูแล", member: "สมาชิก" } as const;

export function MemberCard({ member, isCurrent = false, children }: {
  member: HouseholdMemberWithProfile;
  isCurrent?: boolean;
  children?: ReactNode;
}) {
  const name = member.profile?.display_name || member.profile?.email || "Member";
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar displayName={name} url={member.profile?.avatar_url ?? null} color={member.member_color} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {name} {isCurrent ? <span className="text-sm text-primary">คุณ</span> : null}
          </p>
          <p className="text-sm text-foreground-muted">
            {ROLE_LABEL[member.role]} · <span style={{ color: member.member_color }}>●</span> {member.member_color}
          </p>
        </div>
      </div>
      {children}
    </Card>
  );
}
