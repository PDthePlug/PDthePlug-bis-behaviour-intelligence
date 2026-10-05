import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { optionalSafeReturnPath } from "@/lib/auth-redirect";
import { requireUser } from "@/lib/supabase/require-user";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Money Lab",
  description: "A private seven-day investigation into your own spending behaviour.",
};

export default async function MoneyLabPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = optionalSafeReturnPath(params.returnTo);
  const next = returnTo ? `/money?returnTo=${encodeURIComponent(returnTo)}` : "/money";
  await requireUser(next);

  const query = new URLSearchParams();
  if (returnTo) query.set("returnTo", returnTo);
  redirect(query.size ? `/labs/mon?${query.toString()}` : "/labs/mon");
}
