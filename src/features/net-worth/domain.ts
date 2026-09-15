import {
  compareMoney,
  subtractMoney,
  sumMoney,
} from "@/lib/utils/money";

export type NetWorthSide = "ASSET" | "LIABILITY";
export type NetWorthKind =
  | "BANK"
  | "CASH"
  | "E_WALLET"
  | "OTHER"
  | "CARD_CREDIT"
  | "CREDIT_CARD"
  | "RECEIVABLE"
  | "DEBT";

export interface PocketBalanceSource {
  walletId: string;
  walletName: string;
  pocketId: string;
  pocketName: string;
  pocketType: "BANK" | "CASH" | "CREDIT_CARD" | "E_WALLET" | "OTHER";
  currency: string;
  balance: string;
  archived: boolean;
}

export interface CardBalanceSource {
  pocketId: string;
  liability: string;
  cardCredit: string;
}

export interface DebtBalanceSource {
  id: string;
  name: string;
  counterparty: string | null;
  debtType: "LIABILITY" | "RECEIVABLE";
  currency: string;
  outstanding: string;
  archived: boolean;
}

export interface NetWorthBreakdownRow {
  id: string;
  side: NetWorthSide;
  kind: NetWorthKind;
  name: string;
  context: string | null;
  amount: string;
  archived: boolean;
}

export interface NetWorthCurrencySummary {
  currency: string;
  assetTotal: string;
  liabilityTotal: string;
  netWorth: string;
  assets: NetWorthBreakdownRow[];
  liabilities: NetWorthBreakdownRow[];
}

export function buildNetWorthDashboard(
  pockets: PocketBalanceSource[],
  cards: CardBalanceSource[],
  debts: DebtBalanceSource[],
): NetWorthCurrencySummary[] {
  const cardsByPocket = new Map(cards.map((card) => [card.pocketId, card]));
  const rowsByCurrency = new Map<string, NetWorthBreakdownRow[]>();

  const addRow = (currency: string, row: NetWorthBreakdownRow) => {
    const rows = rowsByCurrency.get(currency) ?? [];
    rows.push(row);
    rowsByCurrency.set(currency, rows);
  };

  for (const pocket of pockets) {
    if (pocket.pocketType === "CREDIT_CARD") {
      const card = cardsByPocket.get(pocket.pocketId);
      const liability =
        card?.liability ??
        (compareMoney(pocket.balance, "0.00") < 0
          ? subtractMoney("0.00", pocket.balance)
          : "0.00");
      const cardCredit =
        card?.cardCredit ??
        (compareMoney(pocket.balance, "0.00") > 0
          ? pocket.balance
          : "0.00");

      addRow(pocket.currency, {
        id: `card:${pocket.pocketId}`,
        side: "LIABILITY",
        kind: "CREDIT_CARD",
        name: pocket.pocketName,
        context: pocket.walletName,
        amount: liability,
        archived: pocket.archived,
      });

      if (compareMoney(cardCredit, "0.00") > 0) {
        addRow(pocket.currency, {
          id: `card-credit:${pocket.pocketId}`,
          side: "ASSET",
          kind: "CARD_CREDIT",
          name: `ยอดชำระเกิน · ${pocket.pocketName}`,
          context: pocket.walletName,
          amount: cardCredit,
          archived: pocket.archived,
        });
      }
      continue;
    }

    const isNegative = compareMoney(pocket.balance, "0.00") < 0;
    addRow(pocket.currency, {
      id: `pocket:${pocket.pocketId}`,
      side: isNegative ? "LIABILITY" : "ASSET",
      kind: isNegative ? "DEBT" : pocket.pocketType,
      name: pocket.pocketName,
      context: pocket.walletName,
      amount: isNegative ? subtractMoney("0.00", pocket.balance) : pocket.balance,
      archived: pocket.archived,
    });
  }

  for (const debt of debts) {
    addRow(debt.currency, {
      id: `debt:${debt.id}`,
      side: debt.debtType === "RECEIVABLE" ? "ASSET" : "LIABILITY",
      kind: debt.debtType === "RECEIVABLE" ? "RECEIVABLE" : "DEBT",
      name: debt.name,
      context: debt.counterparty,
      amount: debt.outstanding,
      archived: debt.archived,
    });
  }

  return [...rowsByCurrency.entries()]
    .map(([currency, rows]) => {
      const assets = sortBreakdownRows(
        rows.filter((row) => row.side === "ASSET"),
      );
      const liabilities = sortBreakdownRows(
        rows.filter((row) => row.side === "LIABILITY"),
      );
      const assetTotal = sumMoney(assets.map((row) => row.amount));
      const liabilityTotal = sumMoney(
        liabilities.map((row) => row.amount),
      );
      return {
        currency,
        assetTotal,
        liabilityTotal,
        netWorth: subtractMoney(assetTotal, liabilityTotal),
        assets,
        liabilities,
      };
    })
    .sort((a, b) =>
      a.currency === "THB"
        ? -1
        : b.currency === "THB"
          ? 1
          : a.currency.localeCompare(b.currency),
    );
}

function sortBreakdownRows(
  rows: NetWorthBreakdownRow[],
): NetWorthBreakdownRow[] {
  return rows.toSorted(
    (a, b) =>
      compareMoney(b.amount, a.amount) ||
      a.name.localeCompare(b.name, "th") ||
      a.id.localeCompare(b.id),
  );
}
