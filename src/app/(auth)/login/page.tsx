import { LoginForm } from "@/features/auth/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ checkEmail?: string }>;
}) {
  const { checkEmail } = await searchParams;

  return (
    <div className="flex flex-col gap-4">
      {checkEmail ? (
        <p className="rounded-control bg-surface-muted p-3 text-sm text-foreground-muted">
          สมัครสมาชิกสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ
        </p>
      ) : null}
      <LoginForm />
    </div>
  );
}
