import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PasswordRecoveryForm } from "@/features/auth/components/PasswordRecoveryForm";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">ตั้งรหัสผ่านใหม่</h2>
      {user ? (
        <PasswordRecoveryForm mode="reset" />
      ) : (
        <>
          <p className="text-sm">ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่</p>
          <Link href="/forgot-password" className="text-primary">
            ขอลิงก์ตั้งรหัสผ่านใหม่
          </Link>
        </>
      )}
    </div>
  );
}
