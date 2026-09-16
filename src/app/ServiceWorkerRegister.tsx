"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => {
          if (navigator.onLine) void registration.update();
        })
        .catch(() => {
          // Installability is a progressive enhancement; a failed registration
          // (e.g. unsupported browser) should never break the app.
        });
    }
  }, []);

  return null;
}
