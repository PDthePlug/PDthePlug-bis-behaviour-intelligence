import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { optionalSafeReturnPath } from "@/lib/auth-redirect";
import { requireUser } from "@/lib/supabase/require-user";
import { UniversalRuntimeLab } from "./universal-runtime-lab";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "BIS Lab",
  robots: { index: false, follow: false },
};

export default async function DynamicLabPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const labCode = code.toUpperCase();
  if (!/^[A-Z][A-Z0-9_-]{1,11}$/.test(labCode)) notFound();
  const returnTo = optionalSafeReturnPath(query.returnTo);
  const baseNext = `/labs/${encodeURIComponent(code)}`;
  const next = returnTo ? `${baseNext}?returnTo=${encodeURIComponent(returnTo)}` : baseNext;
  await requireUser(next);
  return <UniversalRuntimeLab labCode={labCode} />;
}
