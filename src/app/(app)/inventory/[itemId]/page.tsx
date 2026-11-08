import { ActionForm } from "@/components/ui/ActionForm";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { getMyPrimaryHousehold } from "@/features/household/api";
import {
  getInventoryItem,
  listInventoryDocuments,
} from "@/features/inventory/api";
import {
  archiveInventoryItemAction,
  deleteInventoryDocumentAction,
} from "@/features/inventory/actions";
import { InventoryDocumentForm } from "@/features/inventory/components/InventoryDocumentForm";
import { InventoryItemForm } from "@/features/inventory/components/InventoryItemForm";
import { InventoryQuantityButtons } from "@/features/inventory/components/InventoryQuantityButtons";
import { SendInventoryToShoppingButton } from "@/features/inventory/components/SendInventoryToShoppingButton";
import {
  INVENTORY_CATEGORY_LABEL,
  INVENTORY_DOCUMENT_LABEL,
  inventoryDateLabel,
  inventoryQuantityLabel,
  isLowStock,
} from "@/features/inventory/types";
import { getShoppingItem } from "@/features/shopping/api";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency } from "@/lib/utils/money";

type InventoryDetailPageProps = {
  params: Promise<{ itemId: string }>;
};

export async function InventoryDetailPage({
  params,
}: InventoryDetailPageProps) {
  const { itemId } = await params;
  const { supabase, user } = await requireUser();
  const [item, household] = await Promise.all([
    getInventoryItem(supabase, itemId),
    getMyPrimaryHousehold(supabase, user.id),
  ]);
  if (!item || !household || item.household_id !== household.id) notFound();
  const [documents, shoppingItem] = await Promise.all([
    listInventoryDocuments(supabase, item.id),
    item.shopping_item_id
      ? getShoppingItem(supabase, household.id, item.shopping_item_id)
      : null,
  ]);
  const pendingShoppingId =
    shoppingItem && !shoppingItem.purchased_at ? shoppingItem.id : undefined;
  const canEdit = household.myRole !== "observer";
  const stockStatus =
    Number(item.quantity) === 0
      ? "หมดแล้ว"
      : isLowStock(item)
        ? "ควรเติม"
        : null;
  return (
    <div className="finance-scope flex min-w-0 flex-col gap-5 pb-8">
      <PageHeader title={item.name} backHref="/calendar?view=inventory" />
      <Card className="rounded-[1.5rem] time-tinted-panel">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-finance-primary-strong">
            {INVENTORY_CATEGORY_LABEL[item.category]}
          </p>
          <AppIcon
            name="inventory"
            className="size-8 shrink-0 text-finance-primary-strong/60"
          />
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="min-w-0" aria-live="polite">
            <h1 className="break-words text-2xl font-semibold text-finance-text">
              {inventoryQuantityLabel(item)}
            </h1>
            {stockStatus ? (
              <p className="mt-1 text-sm font-medium text-[#a9513d]">
                {stockStatus}
              </p>
            ) : null}
          </div>
          {canEdit ? <InventoryQuantityButtons item={item} /> : null}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-finance-muted">
          {item.location ? (
            <Info label="เก็บไว้ที่" value={item.location} />
          ) : null}
          {item.restock_threshold !== null ? (
            <Info
              label="เตือนเมื่อเหลือ"
              value={`${item.restock_threshold}${item.unit ? ` ${item.unit}` : ""}`}
            />
          ) : null}
          {item.expiry_date ? (
            <Info
              label="วันหมดอายุ"
              value={inventoryDateLabel(item.expiry_date)}
            />
          ) : null}
          {item.warranty_expires_on ? (
            <Info
              label="ประกันถึง"
              value={inventoryDateLabel(item.warranty_expires_on)}
            />
          ) : null}
          {item.purchase_date ? (
            <Info
              label="วันที่ซื้อ"
              value={inventoryDateLabel(item.purchase_date)}
            />
          ) : null}
          {item.estimated_restock_amount ? (
            <Info
              label="งบเติมของ"
              value={formatCurrency(
                item.estimated_restock_amount,
                item.currency,
              )}
            />
          ) : null}
        </div>
        {item.note ? (
          <p className="mt-4 border-t border-white/80 pt-4 text-sm text-finance-muted">
            {item.note}
          </p>
        ) : null}
      </Card>
      {canEdit || pendingShoppingId ? (
        <div className="flex flex-wrap items-start gap-2">
          <SendInventoryToShoppingButton
            itemId={item.id}
            itemName={item.name}
            pendingShoppingId={pendingShoppingId}
            canEdit={canEdit}
          />
          {canEdit ? (
            <FormSheetButton
              triggerClassName="min-h-11 rounded-full border border-finance-primary/30 px-4 py-2.5 text-sm font-medium text-finance-primary-strong"
              ariaLabel={`แก้ไข ${item.name}`}
              sheetTitle="แก้ไขของในคลัง"
              form={
                <InventoryItemForm householdId={household.id} item={item} />
              }
              tone="finance"
            >
              แก้ไข
            </FormSheetButton>
          ) : null}
        </div>
      ) : null}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-finance-text">เอกสาร</h2>
            <p className="text-xs text-finance-muted">
              ใบเสร็จ คู่มือ และประกัน
            </p>
          </div>
          {canEdit ? (
            <FormSheetButton
              triggerClassName="flex size-10 items-center justify-center rounded-full bg-finance-primary-soft text-finance-primary-strong"
              ariaLabel="เพิ่มเอกสาร"
              sheetTitle="เพิ่มเอกสาร"
              form={
                <InventoryDocumentForm
                  householdId={household.id}
                  itemId={item.id}
                />
              }
              tone="finance"
            >
              <AppIcon name="plus" className="size-5" />
            </FormSheetButton>
          ) : null}
        </div>
        {documents.length ? (
          documents.map((document) => (
            <Card
              key={document.id}
              className="rounded-[1.2rem] bg-finance-surface-strong"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-finance-primary-soft text-finance-primary-strong">
                  <AppIcon name="info" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-finance-text"
                  >
                    {document.title}
                  </a>
                  <p className="text-xs text-finance-muted">
                    {INVENTORY_DOCUMENT_LABEL[document.document_type]} ·{" "}
                    {(document.file_size / 1024).toLocaleString("th-TH", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    KB
                  </p>
                </div>
                {canEdit ? (
                  <ActionForm action={deleteInventoryDocumentAction}>
                    <input type="hidden" name="id" value={document.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <button className="text-xs text-danger">ลบ</button>
                  </ActionForm>
                ) : null}
              </div>
            </Card>
          ))
        ) : (
          <Card className="rounded-[1.2rem] text-center text-sm text-finance-muted">
            ยังไม่มีเอกสารแนบ
          </Card>
        )}
      </section>
      {canEdit ? (
        <div className="flex justify-start border-t border-border pt-3">
          <ConfirmDialog
            triggerLabel="นำออกจากคลัง"
            triggerClassName="min-h-11 rounded-full border border-danger/40 px-4 text-sm font-medium text-danger"
            sheetTitle="นำออกจากคลัง?"
            description={`“${item.name}” จะถูกซ่อนจากคลังของในบ้าน`}
            confirmLabel="นำออกจากคลัง"
            action={archiveInventoryItemAction}
            hiddenFields={{ itemId: item.id }}
          />
        </div>
      ) : null}
    </div>
  );
}

export default async function LegacyInventoryDetailPage({
  params,
}: InventoryDetailPageProps) {
  const { itemId } = await params;
  redirect(`/calendar/inventory/${itemId}`);
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] bg-white/65 p-3">
      <p className="text-xs">{label}</p>
      <p className="mt-1 font-medium text-finance-text">{value}</p>
    </div>
  );
}
