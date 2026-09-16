"use client";

import { useState } from "react";

import { cn } from "@/lib/utils/cn";
import {
  addMoney,
  formatCurrency,
  isNegative,
  percentOfTotal,
} from "@/lib/utils/money";

import type {
  NetWorthBreakdownRow,
  NetWorthCurrencySummary,
  NetWorthKind,
  NetWorthSide,
} from "../domain";

const KIND_LABEL: Record<NetWorthKind, string> = {
  BANK: "บัญชีธนาคาร",
  CASH: "เงินสด",
  E_WALLET: "กระเป๋าเงินดิจิทัล",
  OTHER: "สินทรัพย์อื่น",
  CARD_CREDIT: "ยอดชำระเกินบัตร",
  CREDIT_CARD: "หนี้บัตรเครดิต",
  RECEIVABLE: "เงินให้ยืม",
  DEBT: "หนี้สินอื่น",
};

export function NetWorthCurrencyCard({
  summary,
}: {
  summary: NetWorthCurrencySummary;
}) {
  const [activeSide, setActiveSide] = useState<NetWorthSide>("ASSET");
  const grossTotal = addMoney(summary.assetTotal, summary.liabilityTotal);
  const assetPercent = percentOfTotal(summary.assetTotal, grossTotal);
  const liabilityPercent = percentOfTotal(summary.liabilityTotal, grossTotal);
  const activeRows =
    activeSide === "ASSET" ? summary.assets : summary.liabilities;
  const activeTotal =
    activeSide === "ASSET" ? summary.assetTotal : summary.liabilityTotal;

  return (
    <article className="flex min-w-0 flex-col gap-4">
      <section className="rounded-[1.5rem] bg-finance-surface p-4 shadow-card">
        <div className="border-b border-finance-primary-soft pb-4 text-center">
          <p className="text-sm text-finance-muted">
            ทรัพย์สินสุทธิ · {summary.currency}
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-semibold tabular-nums",
              isNegative(summary.netWorth)
                ? "text-finance-expense"
                : "text-finance-income",
            )}
          >
            {formatCurrency(summary.netWorth, summary.currency)}
          </p>
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-2 gap-3 [&>*]:min-w-0">
          <SummaryColumn
            title="ทรัพย์สิน"
            total={summary.assetTotal}
            percent={assetPercent}
            currency={summary.currency}
            rows={summary.assets}
            tone="asset"
          />
          <SummaryColumn
            title="หนี้สิน"
            total={summary.liabilityTotal}
            percent={liabilityPercent}
            currency={summary.currency}
            rows={summary.liabilities}
            tone="liability"
          />
        </div>
      </section>

      <section className="rounded-[1.5rem] bg-finance-surface p-3 shadow-card">
        <div className="grid grid-cols-2 rounded-full bg-finance-surface-strong p-1">
          <SideButton
            side="ASSET"
            activeSide={activeSide}
            onSelect={setActiveSide}
          >
            ทรัพย์สิน
          </SideButton>
          <SideButton
            side="LIABILITY"
            activeSide={activeSide}
            onSelect={setActiveSide}
          >
            หนี้สิน
          </SideButton>
        </div>

        <div className="mt-3 overflow-hidden rounded-[1.25rem] border border-finance-primary-soft">
          <div className="flex items-center justify-between border-b border-finance-primary-soft px-4 py-3 text-xs text-finance-muted">
            <span>รายการ</span>
            <span>มูลค่า</span>
          </div>
          {activeRows.length > 0 ? (
            activeRows.map((row) => (
              <BreakdownRow
                key={row.id}
                row={row}
                currency={summary.currency}
              />
            ))
          ) : (
            <p className="px-4 py-8 text-center text-sm text-finance-muted">
              ยังไม่มีรายการ
            </p>
          )}
          <div className="flex items-center justify-between border-t border-finance-primary-soft px-4 py-3 font-semibold text-finance-text">
            <span>รวม</span>
            <span className="tabular-nums">
              {formatCurrency(activeTotal, summary.currency)}
            </span>
          </div>
        </div>
      </section>
    </article>
  );
}

function SummaryColumn({
  title,
  total,
  percent,
  currency,
  rows,
  tone,
}: {
  title: string;
  total: string;
  percent: number;
  currency: string;
  rows: NetWorthBreakdownRow[];
  tone: "asset" | "liability";
}) {
  return (
    <div
      className={cn(
        "flex min-h-44 flex-col rounded-[1.25rem] p-3",
        tone === "asset" ? "bg-finance-income/10" : "bg-finance-expense/10",
      )}
    >
      <p className="text-xs text-finance-muted">
        {title} · {percent.toFixed(1)}%
      </p>
      <p
        className={cn(
          "mt-1 truncate text-base font-semibold tabular-nums",
          tone === "asset" ? "text-finance-income" : "text-finance-expense",
        )}
      >
        {formatCurrency(total, currency)}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {rows.slice(0, 3).map((row) => (
          <div
            key={row.id}
            className="min-w-0 rounded-full bg-finance-surface px-2.5 py-2"
          >
            <p className="truncate text-xs font-medium text-finance-text">
              {KIND_LABEL[row.kind]}
            </p>
            <p className="truncate text-[0.6875rem] tabular-nums text-finance-muted">
              {formatCurrency(row.amount, currency)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SideButton({
  side,
  activeSide,
  onSelect,
  children,
}: {
  side: NetWorthSide;
  activeSide: NetWorthSide;
  onSelect: (side: NetWorthSide) => void;
  children: string;
}) {
  const active = activeSide === side;
  return (
    <button
      type="button"
      onClick={() => onSelect(side)}
      aria-pressed={active}
      className={cn(
        "min-h-11 rounded-full px-3 text-sm font-medium",
        active
          ? "bg-finance-primary-soft text-finance-text"
          : "text-finance-muted",
      )}
    >
      {children}
    </button>
  );
}

function BreakdownRow({
  row,
  currency,
}: {
  row: NetWorthBreakdownRow;
  currency: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-finance-primary-soft px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-finance-text">
          {row.name}
        </p>
        <p className="truncate text-xs text-finance-muted">
          {KIND_LABEL[row.kind]}
          {row.context ? ` · ${row.context}` : ""}
          {row.archived ? " · เก็บถาวร" : ""}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          row.side === "ASSET"
            ? "text-finance-income"
            : "text-finance-expense",
        )}
      >
        {formatCurrency(row.amount, currency)}
      </span>
    </div>
  );
}
