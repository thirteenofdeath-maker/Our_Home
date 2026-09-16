import type {
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils/cn";

const controlClassName =
  "block h-13 min-w-0 w-full max-w-full box-border [inline-size:100%] [min-inline-size:0] [max-inline-size:100%] rounded-control border border-border/70 bg-surface px-4 text-base text-foreground shadow-sm outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-3 focus:ring-primary-soft";

/** Two equal form columns that may contain native iOS date/time/number inputs.
 * Explicit minmax tracks and shrinkable children prevent the controls' native
 * intrinsic widths from pushing either border into the neighbouring column. */
export function TwoColumnFieldGrid({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 [&>*]:min-w-0 [&>*]:max-w-full",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-foreground-muted"
      >
        {label}
      </label>
      {children}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClassName, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(controlClassName, props.className)} />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(controlClassName, "h-24 py-2", props.className)}
    />
  );
}
