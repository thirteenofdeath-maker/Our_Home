import Image from "next/image";

/** Shared cover for the Finance overview and every module. */
export function FinanceHeader() {
  return (
    <section className="app-cover app-cover-finance light-cover-copy time-cover relative h-48 overflow-hidden rounded-[1.75rem] p-5 shadow-card sm:h-52 sm:p-6">
      <Image
        src="/art/finance-corner.webp"
        alt="กระเป๋าเงิน เหรียญ และแผนการเงินของบ้าน"
        fill
        priority
        sizes="(orientation: landscape) and (min-width: 700px) calc(100vw - 7rem), (max-width: 640px) 100vw, 576px"
        className="app-cover-image time-cover-image object-cover object-center"
      />
      <div aria-hidden="true" className="time-cover-overlay absolute inset-0" />
      <div className="relative max-w-[58%]">
        <p className="text-xs font-medium text-finance-primary-strong">
          ดูแลเงินอย่างสบายใจ
        </p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight text-finance-text">
          การเงินของบ้าน
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-finance-muted">
          ดูเงินทุกกระเป๋า วางแผนทุกเป้าหมาย
        </p>
      </div>
    </section>
  );
}
