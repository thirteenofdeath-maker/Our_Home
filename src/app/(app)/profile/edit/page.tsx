import { redirect } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { getMyPrimaryHousehold, listHouseholdMembers } from "@/features/household/api";
import { getAvatarDisplayUrl, getCurrentProfile } from "@/features/profile/api";
import { ProfileEditForm } from "@/features/profile/components/ProfileEditForm";
import { requireUser } from "@/lib/auth/require-user";

export default async function EditProfilePage() {
  const { supabase, user } = await requireUser();
  const [profile, household] = await Promise.all([
    getCurrentProfile(supabase, user.id),
    getMyPrimaryHousehold(supabase, user.id),
  ]);
  if (!profile || !household) redirect("/household");
  const members = await listHouseholdMembers(supabase, household.id);
  const membership = members.find((member) => member.user_id === user.id);
  if (!membership) redirect("/household");
  const avatarUrl = await getAvatarDisplayUrl(supabase, profile.avatar_url);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">แก้ไขโปรไฟล์</h1>
      <Card>
        <ProfileEditForm
          householdId={household.id}
          displayName={profile.display_name}
          gender={profile.gender}
          birthday={profile.birthday}
          memberColor={membership.member_color}
          avatarUrl={avatarUrl}
        />
      </Card>
    </div>
  );
}
