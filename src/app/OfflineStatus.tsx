"use client";

import { useEffect, useRef, useState } from "react";

export function OfflineStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    const updateOffline = () => {
      wasOffline.current = true;
      setShowRestored(false);
      setIsOffline(true);
    };
    const updateOnline = () => {
      setIsOffline(false);
      if (wasOffline.current) setShowRestored(true);
    };

    if (!navigator.onLine) updateOffline();
    window.addEventListener("offline", updateOffline);
    window.addEventListener("online", updateOnline);
    return () => {
      window.removeEventListener("offline", updateOffline);
      window.removeEventListener("online", updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!showRestored) return;
    const timeout = window.setTimeout(() => setShowRestored(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [showRestored]);

  if (!isOffline && !showRestored) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[90] mx-auto max-w-md rounded-full px-4 py-2 text-center text-sm font-medium text-white shadow-lg ${isOffline ? "bg-[#8f6f36]" : "bg-primary"}`}
    >
      {isOffline
        ? "ออฟไลน์ · กำลังใช้ข้อมูลล่าสุดในเครื่อง"
        : "กลับมาออนไลน์แล้ว"}
    </div>
  );
}
