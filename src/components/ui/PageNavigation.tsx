import Link from "next/link";

export function PageNavigation({
  page,
  hasNext,
  query,
}: {
  page: number;
  hasNext: boolean;
  query: Record<string, string | string[] | undefined>;
}) {
  function href(next: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (typeof value === "string" && key !== "page") params.set(key, value);
    params.set("page", String(next));
    return `/calendar?${params}`;
  }
  if (page === 1 && !hasNext) return null;
  return (
    <nav
      aria-label="แบ่งหน้ารายการ"
      className="flex items-center justify-between gap-3 text-sm"
    >
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          className="rounded-full bg-finance-surface-strong px-4 py-3"
        >
          ก่อนหน้า
        </Link>
      ) : (
        <span />
      )}
      <span className="text-finance-muted">หน้า {page}</span>
      {hasNext ? (
        <Link
          href={href(page + 1)}
          className="rounded-full bg-finance-surface-strong px-4 py-3"
        >
          ถัดไป
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
