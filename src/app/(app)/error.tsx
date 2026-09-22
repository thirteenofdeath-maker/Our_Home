"use client";

import Link from "next/link";

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <main
      role="alert"
      className="mx-auto flex min-h-[55vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <h1 className="text-xl font-semibold text-foreground">
        เปิดหน้านี้ไม่สำเร็จ
      </h1>
      <p className="text-sm text-foreground-muted">
        การเชื่อมต่ออาจสะดุดชั่วคราว ลองโหลดข้อมูลอีกครั้งได้เลย
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          ลองอีกครั้ง
        </button>
        <Link
          href="/"
          className="rounded-full border border-border px-4 py-2.5 text-sm font-medium text-foreground"
        >
          กลับหน้าหลัก
        </Link>
      </div>
    </main>
  );
}
