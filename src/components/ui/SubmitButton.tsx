"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "./Button";
import { Spinner } from "./Spinner";

export function SubmitButton({ children, disabled, ...props }: ButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      {...props}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
    >
      <span className="relative inline-flex items-center justify-center">
        <span
          className={`inline-flex items-center justify-center gap-2 ${pending ? "opacity-0" : ""}`}
        >
          {children}
        </span>
        {pending ? (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center"
          >
            <Spinner className="border-current/30 border-t-current" />
          </span>
        ) : null}
      </span>
    </Button>
  );
}
