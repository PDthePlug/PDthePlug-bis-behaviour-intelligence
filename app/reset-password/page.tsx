import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/require-user";
import { PasswordRecoveryForm } from "../forgot-password/password-recovery-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  alternates: { canonical: "/reset-password" },
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
  await requireUser("/reset-password");
  return <PasswordRecoveryForm mode="reset" />;
}
