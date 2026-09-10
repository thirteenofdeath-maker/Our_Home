import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PocketCreateLink } from "./PocketCreateLink";

describe("PocketCreateLink", () => {
  it("renders a real anchor with the exact wallet Pocket route", () => {
    const walletId = "44c1996b-bc37-4232-8457-306f12cbba75";
    const html = renderToStaticMarkup(createElement(PocketCreateLink, { walletId }));

    expect(html).toContain("<a ");
    expect(html).toContain(`href="/wallets/${walletId}/pockets/new"`);
    expect(html).toContain("+ เพิ่ม</a>");
    expect(html).not.toContain("<button");
  });
});
