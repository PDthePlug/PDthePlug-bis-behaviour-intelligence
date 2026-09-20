import type { Metadata } from "next";
import { safeReturnPath } from "@/lib/auth-redirect";
import { SignInForm } from "./sign-in-form";
import "./sign-in-cleanup.css";

export const metadata: Metadata = {
  title: "Sign in",
  alternates: { canonical: "/sign-in" },
  robots: { index: false, follow: false },
  description: "Sign in to continue in BIS.",
};

function safeCallbackError(value: string | undefined) {
  if (value === "confirmation") {
    return "That sign-in link could not be confirmed. Request a new secure link and try again.";
  }
  return "";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <SignInForm
      next={safeReturnPath(params.next)}
      initialError={safeCallbackError(params.error)}
    />
  );
}
