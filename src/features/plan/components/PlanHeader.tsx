import Image from "next/image";
import type { ReactNode } from "react";

export function PlanHeader({
  eyebrow,
  title,
  subtitle,
  metrics = [],
  rightAction,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  metrics?: Array<{ value: number | string; label: string }>;
  rightAction?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="app-cover app-cover-calendar relative h-48 overflow-hidden rounded-[1.75rem] p-5 shadow-card sm:h-52 sm:p-6">
      <Image
        src="/art/plan-calendar.webp"
        alt="พื้นที่วางแผนและดูแลเรื่องสำคัญของบ้าน"
        fill
        priority
        sizes="(orientation: landscape) and (min-width: 1024px) calc(100vw - 7rem), (min-width: 700px) calc(100vw - 3rem), 100vw"
        className="app-cover-image object-cover object-center"
      />
      <div aria-hidden="true" className="app-cover-overlay absolute inset-0" />
      <div className="relative max-w-[62%]">
        <p className="text-xs font-medium text-finance-primary-strong">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight text-finance-text">
          {title}
        </h1>
        <p className="mt-1 text-sm text-finance-muted">{subtitle}</p>
      </div>
      {rightAction}
      {footer ? (
        <div className="absolute inset-x-4 bottom-4 min-w-0">{footer}</div>
      ) : metrics.length > 0 ? (
        <div
          className="absolute inset-x-4 bottom-4 grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))`,
          }}
        >
          {metrics.map((item) => (
            <div
              key={item.label}
              className="flex h-[3.25rem] min-w-0 flex-col justify-center rounded-[0.9rem] bg-white/80 px-1 py-1.5 text-center backdrop-blur-sm"
            >
              <p className="text-base font-semibold tabular-nums text-finance-text">
                {item.value}
              </p>
              <p className="truncate text-[10px] text-finance-muted">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
