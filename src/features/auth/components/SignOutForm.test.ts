import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { signOutAction } from "../actions";
import { SignOutForm } from "./SignOutForm";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("SignOutForm", () => {
  it("renders a real form wired to the existing signOutAction, not a new auth implementation", () => {
    const form = SignOutForm();
    expect(form.type).toBe("form");
    // Referential identity, not a string match — proves this reuses the
    // exact existing Server Action rather than a re-implementation.
    expect(form.props.action).toBe(signOutAction);

    const button = form.props.children;
    expect(button.type).toBe("button");
    expect(button.props.type).toBe("submit");
    expect(button.props.children).toBe("ออกจากระบบ");
  });

  it("meets the minimum 44px touch target with a muted, non-alarming style", () => {
    const { className } = SignOutForm().props.children.props;
    expect(className).toContain("h-11"); // 44px minimum
    expect(className).toContain("text-danger"); // muted signal only
    expect(className).not.toContain("bg-danger"); // never the solid, alarming variant
  });

  it("is wired up on the profile edit page, visually separated, and never in the global header", () => {
    const profilePage = read("src/app/(app)/profile/edit/page.tsx");
    expect(profilePage).toContain("<SignOutForm");
    expect(profilePage).toContain("บัญชี");
    expect(profilePage).toContain("border-t border-border");

    const globalLayout = read("src/app/(app)/layout.tsx");
    expect(globalLayout).not.toContain("SignOutForm");
    expect(globalLayout).not.toContain("signOutAction");
  });
});
