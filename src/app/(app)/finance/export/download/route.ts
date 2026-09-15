import { NextRequest } from "next/server";

import { rowsToCsv } from "@/features/exports/csv";
import { nextLocalDate } from "@/features/finance/domain/finance";
import { requireUser } from "@/lib/auth/require-user";
import type { TransactionType } from "@/types/database";

const EXPORT_TYPES = new Set<TransactionType>([
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "DEBT_PRINCIPAL",
]);

function parseUuid(value: string | null): string | null {
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}

function parseTransactionType(value: string | null): TransactionType | null {
  return value && EXPORT_TYPES.has(value as TransactionType)
    ? (value as TransactionType)
    : null;
}

export async function GET(request: NextRequest) {
  const { supabase } = await requireUser();
  const query = request.nextUrl.searchParams;
  const to = query.get("to");
  const { data, error } = await supabase.rpc("get_finance_export", {
    p_from: query.get("from") ? `${query.get("from")}T00:00:00+07:00` : null,
    p_to: to ? `${nextLocalDate(to)}T00:00:00+07:00` : null,
    p_wallet_id: parseUuid(query.get("walletId")),
    p_pocket_id: parseUuid(query.get("pocketId")),
    p_category_id: parseUuid(query.get("categoryId")),
    p_tag_id: parseUuid(query.get("tagId")),
    p_type: parseTransactionType(query.get("type")),
  });

  if (error) return new Response("Export failed", { status: 400 });

  const headers = [
    "id",
    "occurred_at",
    "transaction_type",
    "title",
    "note",
    "category",
    "wallets",
    "pockets",
    "currency",
    "amount",
    "tags",
  ];

  return new Response(
    rowsToCsv((data ?? []) as Record<string, unknown>[], headers),
    {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="our-home-finance.csv"',
      },
    },
  );
}
