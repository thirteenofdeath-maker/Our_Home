import { PasswordRecoveryForm } from "@/features/auth/components/PasswordRecoveryForm";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">ลืมรหัสผ่าน</h2>
      {expired ? (
        <p role="alert" className="text-sm text-danger">
          ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่
        </p>
      ) : null}
      <PasswordRecoveryForm mode="request" />
    </div>
  );
}
