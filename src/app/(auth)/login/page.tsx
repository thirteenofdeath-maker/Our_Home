import { LoginForm } from "@/features/auth/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ checkEmail?: string; authError?: string }>;
}) {
  const { checkEmail, authError } = await searchParams;

  return (
    <div className="flex flex-col gap-4">
      {checkEmail ? (
        <p className="rounded-control bg-surface-muted p-3 text-sm text-foreground-muted">
          สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ
        </p>
      ) : null}
      {authError ? (
        <p role="alert" className="text-sm text-danger">
          ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบหรือขอลิงก์ใหม่
        </p>
      ) : null}
      <LoginForm />
    </div>
  );
}
