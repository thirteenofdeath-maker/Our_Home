import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/shared/BackButton.tsx"), "utf8");

describe("BackButton — hierarchy Back, never browser-history Back", () => {
  it("renders a plain Link to the supplied semantic backHref, not a client-side history navigation", () => {
    expect(source).toContain('href={backHref}');
    expect(source).toContain('import Link from "next/link"');
  });

  it("never inspects browser/router history as a signal for where to navigate", () => {
    // A previous history entry existing is never proof it belongs to Our
    // Home — an external-site deep link can carry that same signal with
    // nothing to do with this app. Checks the actual APIs a
    // history-based implementation would call, not just prose mentioning
    // the concept (this file's own doc comment explains why, in words).
    expect(source).not.toContain("window.history");
    expect(source).not.toContain("document.referrer");
    expect(source).not.toContain("router.back()");
    expect(source).not.toContain("useRouter");
    expect(source).not.toContain("router.push(");
  });

  it("is a plain server-renderable component — no client state or event handler needed for an unconditional Link", () => {
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain("onClick");
  });

  it("uses the shared accessible label every other back control in this app would use", () => {
    expect(source).toContain('aria-label="ย้อนกลับ"');
  });

  it("uses the existing AppIcon system (\"back\") rather than introducing a new icon dependency", () => {
    expect(source).toContain('AppIcon name="back"');
  });
});
