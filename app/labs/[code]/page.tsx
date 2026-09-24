import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";
import { UniversalRuntimeLab } from "./universal-runtime-lab";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "BIS Lab",
  robots: { index: false, follow: false },
};

export default async function DynamicLabPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const labCode = code.toUpperCase();
  if (!/^[A-Z][A-Z0-9_-]{1,11}$/.test(labCode)) notFound();
  await requireUser(`/labs/${code}`);
  return <UniversalRuntimeLab labCode={labCode} />;
}
