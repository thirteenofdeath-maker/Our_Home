"use client";
import { useState } from "react";
import { petInitials } from "../domain/pet";

export function PetPhoto({ name, url, size = "md" }: { name: string; url: string | null; size?: "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const className = `${size === "lg" ? "size-24 text-2xl" : "size-14 text-base"} flex shrink-0 items-center justify-center rounded-full bg-secondary object-cover font-semibold text-foreground`;
  if (url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element -- private signed Storage URL.
    return <img src={url} alt={`รูปของ ${name}`} className={className} onError={() => setFailed(true)} />;
  }
  return <span className={className}>{petInitials(name)}</span>;
}
