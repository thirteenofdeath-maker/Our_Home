import type {
  Database,
  InventoryCategory,
  InventoryDocumentType,
} from "@/types/database";

export type InventoryItem =
  Database["public"]["Tables"]["inventory_items"]["Row"];
export type InventoryDocument =
  Database["public"]["Tables"]["inventory_documents"]["Row"] & {
    url: string;
  };

export const INVENTORY_CATEGORY_LABEL: Record<InventoryCategory, string> = {
  MEDICINE: "ยา",
  PET_SUPPLY: "ของสัตว์เลี้ยง",
  HOUSEHOLD: "ของใช้ในบ้าน",
  FOOD: "อาหาร",
  WARRANTY: "สินค้าและประกัน",
  OTHER: "อื่นๆ",
};

export const INVENTORY_DOCUMENT_LABEL: Record<InventoryDocumentType, string> = {
  RECEIPT: "ใบเสร็จ",
  MANUAL: "คู่มือ",
  WARRANTY: "เอกสารประกัน",
  OTHER: "เอกสารอื่น",
};

export function inventoryQuantityLabel(item: InventoryItem) {
  const value = Number(item.quantity);
  const quantity = Number.isInteger(value)
    ? String(value)
    : value.toLocaleString("th-TH", { maximumFractionDigits: 3 });
  return `${quantity}${item.unit ? ` ${item.unit}` : ""}`;
}

export function isLowStock(item: InventoryItem) {
  return (
    item.restock_threshold !== null &&
    Number(item.quantity) <= Number(item.restock_threshold)
  );
}

export function inventoryDateLabel(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${value}T00:00:00+07:00`));
}

export function isDateWithinDays(
  value: string | null,
  today: string,
  days: number,
) {
  if (!value) return false;
  const start = new Date(`${today}T00:00:00+07:00`).getTime();
  const target = new Date(`${value}T00:00:00+07:00`).getTime();
  return target <= start + days * 86_400_000;
}

export function isPastInventoryDate(value: string, today: string) {
  return value < today;
}
