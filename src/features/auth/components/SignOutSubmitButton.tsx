"use client";

import type { MouseEvent } from "react";
import { buttonClassName } from "@/components/ui/Button";

export function SignOutSubmitButton() {
  const clearPrivateCaches = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const form = event.currentTarget.form;
    const worker = navigator.serviceWorker?.controller;
    if (worker) {
      await new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        const timeout = window.setTimeout(resolve, 2000);
        channel.port1.onmessage = () => {
          window.clearTimeout(timeout);
          channel.port1.close();
          resolve();
        };
        worker.postMessage({ type: "CLEAR_PRIVATE_CACHES" }, [channel.port2]);
      });
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("our-home-"))
          .map((key) => caches.delete(key)),
      );
    }
    form?.requestSubmit();
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
