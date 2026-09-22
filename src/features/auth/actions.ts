"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types/action-state";

const credentialsSchema = z.object({
  email: z.string().trim().email("กรุณากรอกอีเมลให้ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
});

export async function signInAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  redirect("/");
}

const signUpSchema = credentialsSchema.extend({
  displayName: z
    .string()
    .trim()
    .min(1, "กรุณากรอกชื่อที่แสดง")
    .max(60, "ชื่อที่แสดงต้องไม่เกิน 60 ตัวอักษร"),
});

export async function signUpAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName } },
  });
  if (error) {
    return { error: "สมัครสมาชิกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่" };
  }

  redirect("/login?checkEmail=1");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
  redirect("/login");
}

export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = z
    .string()
    .trim()
    .email("กรุณากรอกอีเมลให้ถูกต้อง")
    .safeParse(formData.get("email"));
  if (!email.success) return { error: email.error.issues[0]?.message };
  const { headers } = await import("next/headers");
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  // Server Actions validate same-origin requests. Use the actual Preview origin,
  // so the email returns to the app where the PKCE verifier cookie was created.
  if (!origin) return { error: "ไม่สามารถเปิดลิงก์กู้คืนได้ กรุณาลองใหม่" };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: new URL("/auth/callback?next=/reset-password", origin).href,
  });
  if (error) return { error: "ส่งอีเมลไม่สำเร็จ กรุณารอสักครู่แล้วลองใหม่" };
  // Do not disclose whether this email has an account.
  return { success: true };
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({
      password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
      confirmPassword: z.string(),
    })
    .refine((value) => value.password === value.confirmPassword, {
      message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
    })
    .safeParse({
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { error: "ลิงก์หมดอายุ กรุณาขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้ง" };
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error)
    return {
      error:
        "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาใช้รหัสผ่านใหม่ที่ต่างจากเดิมหรือลองอีกครั้ง",
    };
  return { success: true };
}
