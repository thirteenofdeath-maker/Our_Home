import Link from "next/link";
import type { ReactNode } from "react";

import { buttonClassName } from "@/components/ui/Button";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listTemplates } from "@/features/templates/api";
import { TemplateCard } from "@/features/templates/components/TemplateCard";
import { requireUser } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils/cn";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const { scope } = await searchParams;
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const activeScope = scope === "HOUSEHOLD" && household ? "HOUSEHOLD" : "PERSONAL";

  const templates = await listTemplates(supabase, { scope: activeScope, householdId: household?.id ?? null, includeArchived: true });
  const active = templates.filter((t) => !t.archivedAt);
  const archived = templates.filter((t) => t.archivedAt);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Template รายการ</h1>

      {household ? (
        <div className="flex gap-2">
          <TabLink href="/finance/templates?scope=PERSONAL" active={activeScope === "PERSONAL"}>
            ส่วนตัว
          </TabLink>
          <TabLink href="/finance/templates?scope=HOUSEHOLD" active={activeScope === "HOUSEHOLD"}>
            ครอบครัว
          </TabLink>
        </div>
      ) : null}

      {active.length === 0 ? (
        <p className="py-6 text-center text-sm text-foreground-muted">ยังไม่มี Template</p>
      ) : (
        <div className="flex flex-col gap-2">
          {active.map((item) => (
            <TemplateCard key={item.templateId} item={item} />
          ))}
        </div>
      )}

      <Link href="/finance/templates/new" className={buttonClassName("primary", "lg")}>
        + สร้าง Template
      </Link>

      {archived.length > 0 ? (
        <details className="rounded-card border border-border bg-surface p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground-muted">Template ที่เก็บถาวร ({archived.length})</summary>
          <div className="mt-2 flex flex-col gap-2">
            {archived.map((item) => (
              <TemplateCard key={item.templateId} item={item} />
            ))}
          </div>
        </details>
      ) : null}
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
