import { Field, Input, Select } from "@/components/ui/Field";
import { buttonClassName } from "@/components/ui/Button";
import { listCategories } from "@/features/categories/api";
import { nextLocalDate } from "@/features/finance/domain/finance";
import { getMyPrimaryHousehold } from "@/features/household/api";
import { listPocketsForWallet } from "@/features/pockets/api";
import { listTags } from "@/features/tags/api";
import { searchTransactions, type TransactionSearchFilters } from "@/features/transactions/api";
import { TransactionHistoryList } from "@/features/transactions/components/TransactionHistoryList";
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
  const params = await searchParams;
  const { supabase, user } = await requireUser();

  const type: TypeFilter = TYPE_OPTIONS.some((o) => o.value === params.type) ? (params.type as TypeFilter) : "ALL";
  const status: StatusFilter = STATUS_OPTIONS.some((o) => o.value === params.status) ? (params.status as StatusFilter) : "ACTIVE";
  const walletId = params.walletId || undefined;
  const pocketId = walletId ? params.pocketId || undefined : undefined;
  const categoryId = params.categoryId || undefined;
  const tagId = params.tagId || undefined;

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

  const filters: TransactionSearchFilters = {
    type,
    status,
    walletId,
    pocketId,
    categoryId,
    tagId,
    query: params.q || undefined,
    dateFrom: params.dateFrom ? `${params.dateFrom}T00:00:00+07:00` : undefined,
    dateTo: params.dateTo ? `${nextLocalDate(params.dateTo)}T00:00:00+07:00` : undefined,
  };

  const results = await searchTransactions(supabase, filters);

  return (
    <div className="flex flex-col gap-6">

      <form className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4" method="GET">
        <Field label="ค้นหา (ชื่อรายการ/โน้ต)" htmlFor="q">
          <Input id="q" name="q" type="text" defaultValue={params.q ?? ""} placeholder="เช่น กาแฟ" />
        </Field>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          <Field label="จากวันที่" htmlFor="dateFrom">
            <Input id="dateFrom" name="dateFrom" type="date" defaultValue={params.dateFrom ?? ""} />
          </Field>
          <Field label="ถึงวันที่" htmlFor="dateTo">
            <Input id="dateTo" name="dateTo" type="date" defaultValue={params.dateTo ?? ""} />
          </Field>
        </div>

        <Field label="ประเภท" htmlFor="type">
          <Select id="type" name="type" defaultValue={type}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

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

        <button type="submit" className={buttonClassName("primary", "md")}>
          ค้นหา
        </button>
      </form>

      <TransactionHistoryList items={results} />
    </div>
  );
}
