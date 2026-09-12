import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
// Strips comments before substring checks, so a doc comment explaining
// what a file deliberately does NOT do anymore (e.g. "no longer takes
// renderForm") can't be mistaken for actual code doing that thing.
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const formSheetButton = read("src/components/ui/FormSheetButton.tsx");
const asyncFormSheetButton = read("src/components/ui/AsyncFormSheetButton.tsx");

describe("RSC boundary regression guard — a Server Component may never pass a function prop into a Client Component", () => {
  it("FormSheetButton takes `form: ReactNode` — a plain element, never a render-prop function. This is the actual bug fix: the old `renderForm: () => ReactNode` API worked only when the caller happened to already be \"use client\", and threw \"Functions cannot be passed directly to Client Components\" at runtime for every real Server Component caller (/wallets, /household, PocketCreateLink).", () => {
    expect(formSheetButton).toMatch(/form:\s*ReactNode/);
    expect(stripComments(formSheetButton)).not.toMatch(/renderForm/);
    expect(formSheetButton).toContain("{form}");
  });

  it("no consumer anywhere in src/ passes renderForm={ to <FormSheetButton — the prop no longer exists, so this also guards against a future regression reintroducing it", () => {
    const files = listTsxFiles("src");
    for (const path of files) {
      const source = read(path);
      // Look specifically for a FormSheetButton JSX usage and confirm it
      // never carries a renderForm prop (AsyncFormSheetButton is a
      // separate, legitimately-different component — see below).
      const usesFormSheetButton = /<FormSheetButton\b/.test(source) && !path.endsWith("FormSheetButton.tsx");
      if (usesFormSheetButton) {
        expect(source, path).not.toMatch(/<FormSheetButton[\s\S]*?renderForm=/);
      }
    }
  });

  it("AsyncFormSheetButton's renderForm(data) callback is legitimate ONLY because every real consumer constructing it is itself a \"use client\" component — verified structurally for every current consumer", () => {
    expect(asyncFormSheetButton).toMatch(/renderForm:\s*\(data:\s*T\)\s*=>\s*ReactNode/);
    const files = listTsxFiles("src");
    const consumers = files.filter((path) => {
      if (path.endsWith("AsyncFormSheetButton.tsx") || path.endsWith(".test.ts")) return false;
      return /<AsyncFormSheetButton\b/.test(read(path));
    });
    expect(consumers.length).toBeGreaterThan(0);
    for (const path of consumers) {
      const source = read(path);
      const firstLine = source.split("\n").find((line) => line.trim().length > 0) ?? "";
      expect(firstLine, `${path} must declare "use client" — it constructs a renderForm callback passed to AsyncFormSheetButton, and doing that from a Server Component throws at runtime`).toMatch(
        /^"use client";?$/,
      );
    }
  });

  it("no Server Component (a .tsx file with no \"use client\" directive) anywhere in src/app, src/features, or src/components passes an inline arrow-function value as a JSX prop — the exact shape of the original bug (renderForm={() => ...}), generalized to catch any future recurrence with a different prop name", () => {
    const offenders: string[] = [];
    for (const path of listTsxFiles("src")) {
      if (path.endsWith(".test.ts") || path.endsWith(".test.tsx")) continue;
      const source = read(path);
      const firstLine = source.split("\n").find((line) => line.trim().length > 0) ?? "";
      const isClientComponent = /^"use client";?$/.test(firstLine);
      if (isClientComponent) continue;
      // A prop assigned an arrow function literal: `propName={() => ...}`
      // or `propName={(arg) => ...}`. This intentionally does not match
      // event handlers on plain HTML elements defined inside the SAME
      // file (impossible in a Server Component anyway, since those
      // require client interactivity) — a Server Component has no
      // legitimate reason to construct a closure and hand it to a prop.
      if (/=\{\s*\([^)]*\)\s*=>/.test(source)) {
        offenders.push(path);
      }
    }
    expect(offenders, `Server Components passing an arrow-function prop (illegal RSC boundary crossing): ${offenders.join(", ")}`).toEqual([]);
  });
});

function listTsxFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(resolve(process.cwd(), dir));
  for (const entry of entries) {
    const relPath = join(dir, entry);
    const absPath = resolve(process.cwd(), relPath);
    const stat = statSync(absPath);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      results.push(...listTsxFiles(relPath));
    } else if (entry.endsWith(".tsx")) {
      results.push(relPath.split("\\").join("/"));
    }
  }
  return results;
}
