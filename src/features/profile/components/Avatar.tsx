"use client";

import { useState } from "react";

import { initials } from "../domain/profile";

export function Avatar({ displayName, url, color, size = "md" }: { displayName: string; url: string | null; color: string; size?: "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const className = `${size === "lg" ? "size-20 text-xl" : "size-10 text-sm"} flex shrink-0 items-center justify-center rounded-full object-cover font-semibold text-white`;
  if (url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element -- signed private Storage URLs are short-lived and dynamic.
    return <img src={url} alt={`รูปโปรไฟล์ของ ${displayName}`} className={className} onError={() => setFailed(true)} />;
  }
  return <span className={className} style={{ backgroundColor: color }}>{initials(displayName)}</span>;
}
