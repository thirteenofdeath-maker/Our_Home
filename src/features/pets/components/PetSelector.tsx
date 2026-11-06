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
  selectedPetId: string | null;
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
              className="flex size-11 items-center justify-center rounded-full bg-finance-surface-strong text-finance-muted shadow-sm transition-colors hover:text-finance-text focus-visible:outline-2 focus-visible:outline-finance-primary"
            >
              <AppIcon name="chevron" className="size-4 rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="เลื่อนไปทางขวา"
              className="flex size-11 items-center justify-center rounded-full bg-finance-surface-strong text-finance-muted shadow-sm transition-colors hover:text-finance-text focus-visible:outline-2 focus-visible:outline-finance-primary"
            >
              <AppIcon name="chevron" className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
      <div
        ref={listRef}
        className="flex min-w-0 snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain rounded-[1.25rem] bg-finance-surface-strong p-2 shadow-card [scrollbar-width:none] touch-pan-x [&::-webkit-scrollbar]:hidden"
      >
        <Link
          href="/pets"
          aria-current={selectedPetId === null ? "true" : undefined}
          className={`flex w-20 shrink-0 snap-center flex-col items-center gap-1.5 rounded-[1rem] border px-1 py-2 text-center focus-visible:outline-2 focus-visible:outline-finance-primary ${selectedPetId === null ? "border-finance-primary/30 bg-finance-primary-soft/55" : "border-transparent"}`}
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-finance-primary-soft text-finance-primary-strong">
            <AppIcon name="pets" className="size-6" />
          </span>
          <span className="min-w-0 max-w-full">
            <span className="block text-sm font-semibold text-finance-text">
              ภาพรวม
            </span>
            <span className="block text-xs text-finance-muted">
              {pets.length} ตัว
            </span>
          </span>
        </Link>
        {pets.map((pet) => {
          const isSelected = pet.id === selectedPetId;
          return (
            <Link
              key={pet.id}
              href={`/pets?pet=${pet.id}`}
              aria-current={isSelected ? "true" : undefined}
              className={`flex w-20 shrink-0 snap-center flex-col items-center gap-1.5 rounded-[1rem] border px-1 py-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-finance-primary ${
                isSelected
                  ? "border-finance-primary/30 bg-finance-primary-soft/55"
                  : "border-transparent bg-transparent"
              }`}
            >
              <PetPhoto name={pet.name} url={pet.photoUrl} size="md" />
              <span className="min-w-0 max-w-full">
                <span className="block truncate text-sm font-semibold text-finance-text">
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
