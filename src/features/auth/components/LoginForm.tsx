"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { signInAction } from "../actions";

export function LoginForm() {
  const [state, formAction] = useActionState(signInAction, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="อีเมล" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="รหัสผ่าน" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg">เข้าสู่ระบบ</SubmitButton>
      <p className="text-center text-sm text-foreground-muted">
        ยังไม่มีบัญชี?{" "}
        <Link href="/sign-up" className="font-medium text-primary">
          สมัครสมาชิก
        </Link>
      </p>
    </form>
  );
}
