import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function statements(sql: string): string[] {
  const result: string[] = [];
  const lower = sql.toLowerCase();
  let from = 0;
  while ((from = lower.indexOf("raise exception", from)) >= 0) {
    let quoted = false;
    let end = from;
    for (; end < sql.length; end += 1) {
      if (sql[end] === "'") {
        if (quoted && sql[end + 1] === "'") end += 1;
        else quoted = !quoted;
      } else if (sql[end] === ";" && !quoted) break;
    }
    result.push(sql.slice(from, end));
    from = end + 1;
  }
  return result;
}

function mismatch(statement: string): boolean {
  const match = /^raise\s+exception\s+'((?:''|[^'])*)'(.*)$/is.exec(statement.trim());
  if (!match) return false;
  const placeholders = [...match[1].matchAll(/(?<!%)%(?!%)/g)].length;
  const argsText = match[2].split(/\busing\s+errcode\b/i)[0].trim();
  if (!argsText) return placeholders !== 0;
  let depth = 0;
  let quoted = false;
  let args = argsText.startsWith(",") ? 1 : 0;
  for (let index = 1; index < argsText.length; index += 1) {
    const char = argsText[index];
    if (char === "'") quoted = !quoted;
    else if (!quoted && char === "(") depth += 1;
    else if (!quoted && char === ")") depth -= 1;
    else if (!quoted && depth === 0 && char === ",") args += 1;
  }
  return placeholders !== args;
}

describe("migration RAISE formats", () => {
  it("matches every placeholder with one argument in migrations 0031-0049", () => {
    const directory = resolve(process.cwd(), "supabase/migrations");
    const files = readdirSync(directory).filter((name) => {
      const number = Number(name.slice(0, 4));
      return number >= 31 && number <= 49 && name.endsWith(".sql");
    });
    const failures = files.flatMap((file) =>
      statements(readFileSync(resolve(directory, file), "utf8"))
        .filter(mismatch)
        .map((statement) => `${file}: ${statement.replace(/\s+/g, " ")}`),
    );
    expect(failures).toEqual([]);
  });
});
