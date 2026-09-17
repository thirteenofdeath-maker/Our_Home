import Image from "next/image";

/** Shared cover for the Finance overview and every module. */
export function FinanceHeader() {
  return (
    <section className="relative h-48 overflow-hidden rounded-[1.75rem] bg-[#f7f1e6] p-5 shadow-card sm:h-52 sm:p-6">
      <Image
        src="/art/finance-corner.webp"
        alt="กระเป๋าเงิน เหรียญ และแผนการเงินของบ้าน"
        fill
        priority
        sizes="(max-width: 640px) 100vw, 576px"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,250,241,0.98)_0%,rgba(255,250,241,0.88)_42%,rgba(255,250,241,0.06)_78%)]" />
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
