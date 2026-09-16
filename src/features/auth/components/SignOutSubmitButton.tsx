"use client";

import { buttonClassName } from "@/components/ui/Button";

export function SignOutSubmitButton() {
  const clearPrivateCaches = () => {
    navigator.serviceWorker?.controller?.postMessage({
      type: "CLEAR_PRIVATE_CACHES",
    });
  };

  return (
    <button
      type="submit"
      onClick={clearPrivateCaches}
      className={buttonClassName("secondary", "md", "text-danger")}
    >
      ออกจากระบบ
    </button>
  );
}
