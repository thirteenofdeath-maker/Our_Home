import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-2xl font-semibold">Our Home</h1>
        <div className="rounded-card border border-border bg-surface p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
