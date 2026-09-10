import Link from "next/link";
import type { ReactNode } from "react";

import { buttonClassName } from "@/components/ui/Button";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listRecurringTransactions, listUpcomingOccurrencesForScope, materializeRecurringOccurrences } from "@/features/recurring/api";
import { OccurrenceCard } from "@/features/recurring/components/OccurrenceCard";
import { RecurringCard } from "@/features/recurring/components/RecurringCard";
import { requireUser } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils/cn";

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const { scope } = await searchParams;
  const household = await getMyPrimaryHousehold(supabase, user.id);
  const activeScope = scope === "HOUSEHOLD" && household ? "HOUSEHOLD" : "PERSONAL";
  const householdId = household?.id ?? null;

  // Idempotent, bounded — always materialize before reading (docs/FINANCE.md Phase G).
  await materializeRecurringOccurrences(supabase, { scope: activeScope, householdId });

  const [rules, upcoming] = await Promise.all([
    listRecurringTransactions(supabase, { scope: activeScope, householdId, includeArchived: true }),
    listUpcomingOccurrencesForScope(supabase, { scope: activeScope, householdId, limit: 20 }),
  ]);

  const active = rules.filter((r) => !r.archivedAt && !r.pausedAt);
  const paused = rules.filter((r) => !r.archivedAt && r.pausedAt);
  const archived = rules.filter((r) => r.archivedAt);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">รายการประจำ</h1>

      {household ? (
        <div className="flex gap-2">
          <TabLink href="/finance/recurring?scope=PERSONAL" active={activeScope === "PERSONAL"}>
            ส่วนตัว
          </TabLink>
          <TabLink href="/finance/recurring?scope=HOUSEHOLD" active={activeScope === "HOUSEHOLD"}>
            ครอบครัว
          </TabLink>
        </div>
      ) : null}

      <Link href="/finance/recurring/new" className={buttonClassName("primary", "lg")}>
        + เพิ่มรายการประจำ
      </Link>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">กำลังจะถึง</h2>
        {upcoming.length === 0 ? (
          <p className="py-4 text-center text-sm text-foreground-muted">ยังไม่มีรายการที่กำลังจะถึง</p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((item) => (
              <OccurrenceCard key={item.occurrenceId} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">ใช้งานอยู่</h2>
        {active.length === 0 ? (
          <p className="py-4 text-center text-sm text-foreground-muted">ยังไม่มีรายการประจำ</p>
        ) : (
          <div className="flex flex-col gap-2">
            {active.map((item) => (
              <RecurringCard key={item.recurringId} item={item} />
            ))}
          </div>
        )}
      </section>

      {paused.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">หยุดชั่วคราว</h2>
          <div className="flex flex-col gap-2">
            {paused.map((item) => (
              <RecurringCard key={item.recurringId} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {archived.length > 0 ? (
        <details className="rounded-card border border-border bg-surface p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground-muted">เก็บถาวรแล้ว ({archived.length})</summary>
          <div className="mt-2 flex flex-col gap-2">
            {archived.map((item) => (
              <RecurringCard key={item.recurringId} item={item} />
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
