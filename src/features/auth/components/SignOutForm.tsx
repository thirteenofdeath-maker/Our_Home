import { buttonClassName } from "@/components/ui/Button";

import { signOutAction } from "../actions";

export function SignOutForm() {
  return (
    <form action={signOutAction}>
      <button type="submit" className={buttonClassName("secondary", "md", "text-danger")}>
        ออกจากระบบ
      </button>
    </form>
  );
}
