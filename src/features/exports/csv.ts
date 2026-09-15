const FORMULA_PREFIX = /^[\t\r ]*[=+@-]/;
const PLAIN_NUMBER = /^-?\d+(?:\.\d+)?$/;

/** Prevent spreadsheet formula execution without turning valid amounts into text. */
function neutralizeFormula(text: string): string {
  return FORMULA_PREFIX.test(text) && !PLAIN_NUMBER.test(text.trim())
    ? `'${text}`
    : text;
}

export function csvCell(value: unknown): string {
  const text = neutralizeFormula(value == null ? "" : String(value));
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToCsv(
  rows: Record<string, unknown>[],
  headers: string[],
): string {
  const headerRow = headers.map(csvCell).join(",");
  const dataRows = rows.map((row) =>
    headers.map((header) => csvCell(row[header])).join(","),
  );
  return `\uFEFF${[headerRow, ...dataRows].join("\r\n")}`;
}
