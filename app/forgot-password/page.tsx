import type { Metadata } from "next";
import { PasswordRecoveryForm } from "./password-recovery-form";

export const metadata: Metadata = {
  title: "Reset your password",
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <PasswordRecoveryForm mode="request" />;
}
