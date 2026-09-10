import Link from "next/link";

import { buttonClassName } from "@/components/ui/Button";
import { AppIcon } from "@/components/ui/AppIcon";
import { Field, Input, Select } from "@/components/ui/Field";
import { listCategories } from "@/features/categories/api";
import { bangkokDateKey } from "@/features/calendar/domain/calendar";
import { nextLocalDate } from "@/features/finance/domain/finance";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listPocketsForWallet } from "@/features/pockets/api";
import { listTags } from "@/features/tags/api";
import { searchTransactions, type TransactionSearchFilters } from "@/features/transactions/api";
import { FinanceFilterSheet } from "@/features/transactions/components/FinanceFilterSheet";
import { TransactionHistoryList } from "@/features/transactions/components/TransactionHistoryList";
import { groupTransactionsByDate } from "@/features/transactions/domain/groupByDate";
import type { TransactionHistoryItem } from "@/features/transactions/types";
import { listMyWallets } from "@/features/wallets/api";
import { requireUser } from "@/lib/auth/require-user";

type TypeFilter = NonNullable<TransactionSearchFilters["type"]>;
type StatusFilter = NonNullable<TransactionSearchFilters["status"]>;

const TYPE_OPTIONS: Array<{ value: TypeFilter; label: string }> = [
  { value: "ALL", label: "ทั้งหมด" },
  { value: "INCOME", label: "รายรับ" },
  { value: "EXPENSE", label: "รายจ่าย" },
  { value: "REFUND", label: "คืนเงิน" },
  { value: "REIMBURSEMENT", label: "เบิกคืน" },
  { value: "POCKET_TRANSFER", label: "โอนระหว่างช่อง" },
  { value: "WALLET_TRANSFER", label: "โอนระหว่างกระเป๋าเงิน" },
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ACTIVE", label: "ปกติ" },
  { value: "VOIDED", label: "ยกเลิกแล้ว" },
  { value: "ALL", label: "ทั้งหมด" },
];

/**
 * Simple type PILLS shown above the results — a coarser, page-level
 * convenience on top of the same accepted `type=` values `searchTransactions`
 * already understands, never a new filter meaning. "โอนเงิน" is the one
 * exception: there is no single existing value covering both
 * POCKET_TRANSFER and WALLET_TRANSFER, and searchTransactions itself is
 * not changed to add one (per the Phase 1 brief) — so this page-only
 * pseudo-value "TRANSFER" triggers two calls to the untouched function
 * below (one per real transfer type) and merges the results, rather than
 * teaching the domain function a new value.
 */
const PILLS: Array<{ value: "ALL" | "EXPENSE" | "INCOME" | "TRANSFER"; label: string }> = [
  { value: "ALL", label: "ทั้งหมด" },
  { value: "EXPENSE", label: "รายจ่าย" },
  { value: "INCOME", label: "รายรับ" },
  { value: "TRANSFER", label: "โอนเงิน" },
];

function buildHref(params: Record<string, string | undefined>, overrides: Record<string, string | undefined>): string {
  const merged = { ...params, ...overrides };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) query.set(key, value);
  }
  const queryString = query.toString();
  return queryString ? `/finance/transactions?${queryString}` : "/finance/transactions";
}

function HiddenFields({ params, except }: { params: Record<string, string | undefined>; except: string[] }) {
  return (
    <>
      {Object.entries(params)
        .filter(([key, value]) => value && !except.includes(key))
        .map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
    </>
  );
}

export default async function TransactionSearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
    type?: string;
    walletId?: string;
    pocketId?: string;
    categoryId?: string;
    tagId?: string;
    status?: string;
    q?: string;
  }>;
}) {
  const rawParams = await searchParams;
  const { supabase, user } = await requireUser();

  // The pill row's pseudo "TRANSFER" value is recognized here only —
  // everything passed into TransactionSearchFilters.type below is still
  // exactly one of searchTransactions' own accepted values.
  const isTransferPill = rawParams.type === "TRANSFER";
  const type: TypeFilter = TYPE_OPTIONS.some((o) => o.value === rawParams.type) ? (rawParams.type as TypeFilter) : "ALL";
  const status: StatusFilter = STATUS_OPTIONS.some((o) => o.value === rawParams.status) ? (rawParams.status as StatusFilter) : "ACTIVE";
  const walletId = rawParams.walletId || undefined;
  const pocketId = walletId ? rawParams.pocketId || undefined : undefined;
  const categoryId = rawParams.categoryId || undefined;
  const tagId = rawParams.tagId || undefined;

  const household = await getMyPrimaryHousehold(supabase, user.id);

  const [wallets, incomeCategories, expenseCategories, pockets, personalTags, householdTags] = await Promise.all([
    listMyWallets(supabase),
    listCategories(supabase, { transactionType: "INCOME" }),
    listCategories(supabase, { transactionType: "EXPENSE" }),
    walletId ? listPocketsForWallet(supabase, walletId) : Promise.resolve([]),
    listTags(supabase, { scope: "PERSONAL" }),
    household ? listTags(supabase, { scope: "HOUSEHOLD", householdId: household.id }) : Promise.resolve([]),
  ]);
  const categories = [...incomeCategories, ...expenseCategories].sort((a, b) => a.name.localeCompare(b.name));

  const sharedFilters: Omit<TransactionSearchFilters, "type"> = {
    status,
    walletId,
    pocketId,
    categoryId,
    tagId,
    query: rawParams.q || undefined,
    dateFrom: rawParams.dateFrom ? `${rawParams.dateFrom}T00:00:00+07:00` : undefined,
    dateTo: rawParams.dateTo ? `${nextLocalDate(rawParams.dateTo)}T00:00:00+07:00` : undefined,
  };

  let results: TransactionHistoryItem[];
  if (isTransferPill) {
    const [pocketTransfers, walletTransfers] = await Promise.all([
      searchTransactions(supabase, { ...sharedFilters, type: "POCKET_TRANSFER" }),
      searchTransactions(supabase, { ...sharedFilters, type: "WALLET_TRANSFER" }),
    ]);
    results = [...pocketTransfers, ...walletTransfers].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 100);
  } else {
    results = await searchTransactions(supabase, { ...sharedFilters, type });
  }

  const activePillValue: (typeof PILLS)[number]["value"] = isTransferPill ? "TRANSFER" : type === "INCOME" || type === "EXPENSE" ? type : "ALL";
  const hasAdvancedFilters = Boolean(rawParams.dateFrom || rawParams.dateTo || rawParams.walletId || rawParams.pocketId || rawParams.categoryId || rawParams.tagId || (rawParams.status && rawParams.status !== "ACTIVE"));

  const today = bangkokDateKey();
  const groups = groupTransactionsByDate(results, today);

  return (
    <div className="finance-scope -mx-4 flex flex-col gap-4 px-4 pb-8 pt-2">
      <div className="flex items-center gap-2">
        <form method="GET" className="flex-1">
          <HiddenFields params={rawParams} except={["q"]} />
          <div className="relative">
            <AppIcon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-finance-muted" />
            <input
              name="q"
              type="search"
              defaultValue={rawParams.q ?? ""}
              placeholder="ค้นหารายการ..."
              aria-label="ค้นหารายการ"
              className="h-11 w-full rounded-full border-none bg-finance-surface-strong pl-9 pr-4 text-base text-finance-text shadow-sm outline-none focus:ring-3 focus:ring-finance-primary-soft"
            />
          </div>
        </form>

        <FinanceFilterSheet active={hasAdvancedFilters}>
          <form method="GET" className="flex flex-col gap-3">
            <HiddenFields params={rawParams} except={["dateFrom", "dateTo", "status", "walletId", "pocketId", "categoryId", "tagId"]} />

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
              <Field label="จากวันที่" htmlFor="dateFrom">
                <Input id="dateFrom" name="dateFrom" type="date" defaultValue={rawParams.dateFrom ?? ""} />
              </Field>
              <Field label="ถึงวันที่" htmlFor="dateTo">
                <Input id="dateTo" name="dateTo" type="date" defaultValue={rawParams.dateTo ?? ""} />
              </Field>
            </div>

            <Field label="สถานะ" htmlFor="status">
              <Select id="status" name="status" defaultValue={status}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="กระเป๋าเงิน" htmlFor="walletId">
              <Select id="walletId" name="walletId" defaultValue={walletId ?? ""}>
                <option value="">ทั้งหมด</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>

            {walletId ? (
              <Field label="ช่อง (Pocket)" htmlFor="pocketId">
                <Select id="pocketId" name="pocketId" defaultValue={pocketId ?? ""}>
                  <option value="">ทั้งหมด</option>
                  {pockets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <Field label="หมวดหมู่" htmlFor="categoryId">
              <Select id="categoryId" name="categoryId" defaultValue={categoryId ?? ""}>
                <option value="">ทั้งหมด</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            {personalTags.length > 0 || householdTags.length > 0 ? (
              <Field label="แท็ก" htmlFor="tagId">
                <Select id="tagId" name="tagId" defaultValue={tagId ?? ""}>
                  <option value="">ทั้งหมด</option>
                  {personalTags.length > 0 ? (
                    <optgroup label="ส่วนตัว">
                      {personalTags.map((t) => (
                        <option key={t.id} value={t.id}>
                          #{t.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {householdTags.length > 0 ? (
                    <optgroup label="ครอบครัว">
                      {householdTags.map((t) => (
                        <option key={t.id} value={t.id}>
                          #{t.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </Select>
              </Field>
            ) : null}

            {/* Finance V2 blue-gray palette for this one button only —
                `!` forces it over buttonClassName's own bg-primary/
                text-primary-foreground regardless of Tailwind's utility
                generation order, without touching Button.tsx itself or
                any other button in the app. */}
            <button type="submit" className={buttonClassName("primary", "md", "!bg-finance-primary !text-white")}>
              ใช้ตัวกรอง
            </button>
            <Link href="/finance/transactions" className={buttonClassName("ghost", "md", "!text-finance-text")}>
              ล้างตัวกรอง
            </Link>
          </form>
        </FinanceFilterSheet>
      </div>

      <nav aria-label="ประเภทรายการ" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex w-max gap-2">
          {PILLS.map((pill) => {
            const active = activePillValue === pill.value;
            return (
              <li key={pill.value}>
                <Link
                  href={buildHref(rawParams, { type: pill.value === "ALL" ? undefined : pill.value })}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ${
                    active ? "bg-finance-primary text-white" : "bg-finance-surface-strong text-finance-muted"
                  }`}
                >
                  {pill.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {groups.length === 0 ? (
        <TransactionHistoryList items={[]} variant="full" />
      ) : (
        groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-finance-muted">{group.label}</h2>
            <TransactionHistoryList items={group.items} variant="full" />
          </section>
        ))
      )}
    </div>
  );
}
