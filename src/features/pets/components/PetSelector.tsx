"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";

import { AppIcon } from "@/components/ui/AppIcon";
import { PetPhoto } from "@/features/pets/components/PetPhoto";

type PetSelectorItem = {
  id: string;
  name: string;
  photoUrl: string | null;
  detail: string;
};

export function PetSelector({
  pets,
  selectedPetId,
}: {
  pets: PetSelectorItem[];
  selectedPetId: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !selected) return;

    selected.scrollIntoView({
      behavior: "instant",
      block: "nearest",
      inline: "center",
    });
  }, [selectedPetId]);

  const scroll = useCallback((direction: -1 | 1) => {
    const list = listRef.current;
    if (!list) return;
    list.scrollBy({
      left: direction * list.clientWidth * 0.72,
      behavior: "smooth",
    });
  }, []);

  return (
    <section
      className="flex min-w-0 flex-col gap-3"
      aria-labelledby="pet-selector-title"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="pet-selector-title" className="font-semibold text-finance-text">
          เลือกสัตว์เลี้ยง
        </h2>
        {pets.length > 3 ? (
          <div className="flex gap-1" aria-label="เลื่อนรายชื่อสัตว์เลี้ยง">
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="เลื่อนไปทางซ้าย"
              className="flex size-9 items-center justify-center rounded-full bg-finance-surface-strong text-finance-muted shadow-sm transition-colors hover:text-finance-text focus-visible:outline-2 focus-visible:outline-finance-primary"
            >
              <AppIcon name="chevron" className="size-4 rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="เลื่อนไปทางขวา"
              className="flex size-9 items-center justify-center rounded-full bg-finance-surface-strong text-finance-muted shadow-sm transition-colors hover:text-finance-text focus-visible:outline-2 focus-visible:outline-finance-primary"
            >
              <AppIcon name="chevron" className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
      <div
        ref={listRef}
        className="flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain rounded-[1.5rem] bg-finance-surface-strong p-3 shadow-card [scrollbar-width:none] touch-pan-x [&::-webkit-scrollbar]:hidden"
      >
        {pets.map((pet) => {
          const isSelected = pet.id === selectedPetId;
          return (
            <Link
              key={pet.id}
              href={`/pets?pet=${pet.id}`}
              aria-current={isSelected ? "true" : undefined}
              className={`flex w-24 shrink-0 snap-center flex-col items-center gap-2 rounded-[1.15rem] border p-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-finance-primary ${
                isSelected
                  ? "border-finance-primary/30 bg-finance-primary-soft/55"
                  : "border-transparent bg-transparent"
              }`}
            >
              <PetPhoto name={pet.name} url={pet.photoUrl} size="md" />
              <span className="min-w-0 max-w-full">
                <span className="block truncate font-semibold text-finance-text">
                  {pet.name}
                </span>
                <span className="block truncate text-xs text-finance-muted">
                  {pet.detail}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
