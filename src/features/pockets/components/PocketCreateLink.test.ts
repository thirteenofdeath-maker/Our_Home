import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PocketCreateLink } from "./PocketCreateLink";

describe("PocketCreateLink", () => {
  it("opens a form sheet (FormSheetButton) with the real AddPocketForm sliding up directly — no intermediate choice sheet for a single creation type, trigger is a button not a navigating anchor", () => {
    const walletId = "44c1996b-bc37-4232-8457-306f12cbba75";
    const html = renderToStaticMarkup(createElement(PocketCreateLink, { walletId }));

    // The trigger is a real <button>, carrying no href of its own.
    expect(html).toMatch(/<button[^>]*>[\s\S]*?\+ เพิ่ม/);
    const triggerTag = html.match(/<button[^>]*>/)?.[0] ?? "";
    expect(triggerTag).not.toContain("href=");
    // The sheet renders AddPocketForm's real hidden walletId field and
    // submit button — never a link to the full-page route.
    expect(html).toContain("เพิ่ม Pocket");
    expect(html).toContain(`value="${walletId}"`);
    expect(html).not.toContain(`href="/wallets/${walletId}/pockets/new"`);
  });
});
