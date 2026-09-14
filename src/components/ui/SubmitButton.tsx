"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "./Button";
import { Spinner } from "./Spinner";

export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? <Spinner className="border-current/30 border-t-current" /> : children}
    </Button>
  );
}
