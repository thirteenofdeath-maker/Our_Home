import Link from "next/link";
import type { ReactNode } from "react";

import { getMyPrimaryHousehold } from "@/features/household/api";
import { listTags } from "@/features/tags/api";
import { AddTagForm } from "@/features/tags/components/AddTagForm";
import { TagManagerList } from "@/features/tags/components/TagManagerList";
import { requireUser } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils/cn";

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const { scope } = await searchParams;
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const activeScope = scope === "HOUSEHOLD" && household ? "HOUSEHOLD" : "PERSONAL";

  const tags = await listTags(supabase, { scope: activeScope, householdId: household?.id ?? null, includeArchived: true });

  return (
    <div className="flex flex-col gap-4">

      {household ? (
        <div className="flex gap-2">
          <TabLink href="/finance/tags?scope=PERSONAL" active={activeScope === "PERSONAL"}>
            ส่วนตัว
          </TabLink>
          <TabLink href="/finance/tags?scope=HOUSEHOLD" active={activeScope === "HOUSEHOLD"}>
            ครอบครัว
          </TabLink>
        </div>
      ) : null}

      <TagManagerList tags={tags} />

      <AddTagForm scope={activeScope} />
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-control px-3 py-1.5 text-sm font-medium",
        active ? "bg-primary text-primary-foreground" : "bg-surface-muted text-foreground-muted",
      )}
    >
      {children}
    </Link>
  );
}
