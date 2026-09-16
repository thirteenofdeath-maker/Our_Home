import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/Card";
import { SignOutForm } from "@/features/auth/components/SignOutForm";
import {
  getMyPrimaryHousehold,
  listHouseholdMembers,
} from "@/features/household/api";
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
    <div className="flex min-w-0 max-w-full flex-col gap-4">
      {/* Reachable from the avatar link on every one of the four
          BottomNav roots — there's no single true parent route, so this
          is the rare case where the fallback is a stable, sensible app
          default rather than a derivable parent. router.back() still
          covers the actual common case (arriving from whichever root the
          user was on) correctly regardless of this choice. */}
      <PageHeader title="แก้ไขโปรไฟล์" backHref="/finance" />
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

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h2 className="font-semibold">บัญชี</h2>
        <SignOutForm />
      </section>
    </div>
  );
}
