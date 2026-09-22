import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { Card } from "@/components/ui/Card";
import { FormSheetButton } from "@/components/ui/FormSheetButton";
import { getMyPrimaryHousehold } from "@/features/household/api";
import {
  getInventoryItem,
  listInventoryDocuments,
} from "@/features/inventory/api";
import {
  archiveInventoryItemAction,
  deleteInventoryDocumentAction,
  sendInventoryToShoppingAction,
} from "@/features/inventory/actions";
import { InventoryDocumentForm } from "@/features/inventory/components/InventoryDocumentForm";
import {
  INVENTORY_CATEGORY_LABEL,
  INVENTORY_DOCUMENT_LABEL,
  inventoryDateLabel,
  inventoryQuantityLabel,
  isLowStock,
} from "@/features/inventory/types";
import { requireUser } from "@/lib/auth/require-user";
import { formatCurrency } from "@/lib/utils/money";

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const { supabase, user } = await requireUser();
  const [item, household] = await Promise.all([
    getInventoryItem(supabase, itemId),
    getMyPrimaryHousehold(supabase, user.id),
  ]);
  if (!item || !household || item.household_id !== household.id) notFound();
  const documents = await listInventoryDocuments(supabase, item.id);
  const canEdit = household.myRole !== "observer";
  return (
    <div className="finance-scope flex min-w-0 flex-col gap-5 pb-8">
      <PageHeader title={item.name} backHref="/inventory" />
      <Card className="rounded-[1.5rem] bg-[linear-gradient(145deg,#edf4e8,#fff9ee_62%,#f6e2d8)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-finance-primary-strong">
              {INVENTORY_CATEGORY_LABEL[item.category]}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-finance-text">
              {inventoryQuantityLabel(item)}
            </h1>
            {isLowStock(item) ? (
              <p className="mt-1 text-sm font-medium text-[#a9513d]">
                ถึงระดับที่ควรเติมแล้ว
              </p>
            ) : null}
          </div>
          <AppIcon
            name="inventory"
            className="size-10 text-finance-primary-strong/60"
          />
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
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <form action={sendInventoryToShoppingAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <button className="rounded-full bg-finance-primary px-4 py-2.5 text-sm font-medium text-white">
              {item.shopping_item_id
                ? "ส่งอีกครั้งเมื่อซื้อหมด"
                : "ส่งไปรายการซื้อ"}
            </button>
          </form>
          {item.shopping_item_id ? (
            <Link
              href="/shopping"
              className="rounded-full border border-finance-primary/30 px-4 py-2.5 text-sm font-medium text-finance-primary-strong"
            >
              ดูรายการซื้อ
            </Link>
          ) : null}
          <form action={archiveInventoryItemAction}>
            <input type="hidden" name="itemId" value={item.id} />
            <button className="rounded-full border border-border px-4 py-2.5 text-sm text-finance-muted">
              นำออกจากคลัง
            </button>
          </form>
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
                  <form action={deleteInventoryDocumentAction}>
                    <input type="hidden" name="id" value={document.id} />
                    <input type="hidden" name="itemId" value={item.id} />
                    <button className="text-xs text-danger">ลบ</button>
                  </form>
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
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] bg-white/65 p-3">
      <p className="text-xs">{label}</p>
      <p className="mt-1 font-medium text-finance-text">{value}</p>
    </div>
  );
}
