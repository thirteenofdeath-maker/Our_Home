import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-primary-soft text-foreground hover:brightness-95",
  ghost: "bg-transparent text-foreground hover:bg-surface-muted",
  danger: "bg-danger text-danger-foreground hover:opacity-90",
};

const sizeClasses: Record<Size, string> = {
  md: "h-11 px-4 text-sm",
  lg: "h-14 px-5 text-base",
};

export function buttonClassName(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex w-full items-center justify-center gap-2 rounded-control font-medium shadow-sm transition-[transform,filter,opacity,background-color] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, ...props },
  ref,
) {
  return <button ref={ref} className={buttonClassName(variant, size, className)} {...props} />;
});
