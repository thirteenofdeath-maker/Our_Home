"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/lib/types/action-state";
import { requestPasswordResetAction, resetPasswordAction } from "../actions";

export function PasswordRecoveryForm({ mode }: { mode: "request" | "reset" }) {
  const [state, action] = useActionState(
    mode === "request" ? requestPasswordResetAction : resetPasswordAction,
    initialActionState,
  );
  if (state.success)
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-sm leading-relaxed">
          {mode === "request"
            ? "หากอีเมลนี้มีบัญชี เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้ กรุณาตรวจกล่องจดหมายและสแปม แล้วเปิดลิงก์ด้วยเบราว์เซอร์เดียวกับที่ขอ"
            : "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว"}
        </p>
        <Link
          href={mode === "request" ? "/login" : "/"}
          className="text-center font-medium text-primary"
        >
          {mode === "request" ? "กลับไปเข้าสู่ระบบ" : "กลับหน้าหลัก"}
        </Link>
      </div>
    );
  return (
    <form action={action} className="flex flex-col gap-4">
      {mode === "request" ? (
        <Field label="อีเมลที่ใช้สมัคร" htmlFor="recovery-email">
          <Input
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </Field>
      ) : (
        <>
          <Field label="รหัสผ่านใหม่" htmlFor="new-password">
            <Input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <Field label="ยืนยันรหัสผ่านใหม่" htmlFor="confirm-password">
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
        </>
      )}
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <SubmitButton size="lg">
        {mode === "request" ? "ส่งลิงก์ตั้งรหัสผ่านใหม่" : "บันทึกรหัสผ่านใหม่"}
      </SubmitButton>
      <Link href="/login" className="text-center text-sm text-primary">
        กลับไปเข้าสู่ระบบ
      </Link>
    </form>
  );
}
