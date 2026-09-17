import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to continue in BIS.",
};

function safeReturnPath(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

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
