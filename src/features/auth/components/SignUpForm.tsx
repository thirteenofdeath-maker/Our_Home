"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";

import { signUpAction } from "../actions";

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="ชื่อที่แสดง" htmlFor="displayName">
        <Input id="displayName" name="displayName" type="text" autoComplete="name" required />
      </Field>
      <Field label="อีเมล" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="รหัสผ่าน" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton size="lg">สมัครสมาชิก</SubmitButton>
      <p className="text-center text-sm text-foreground-muted">
        มีบัญชีอยู่แล้ว?{" "}
        <Link href="/login" className="font-medium text-primary">
          เข้าสู่ระบบ
        </Link>
      </p>
    </form>
  );
}
