import { notFound } from "next/navigation";
import { HandbookVerification } from "./verification";
export const dynamic = "force-dynamic";
export default async function VerificationPage({ searchParams }: { searchParams: Promise<{ frame?: string; view?: string; page?: string; edition?: string }> }) {
  // Synthetic browser fixture only; never opens production records or bypasses auth.
  if (process.env.VERCEL_ENV !== "preview") notFound();
  const params = await searchParams;
  return <HandbookVerification initialFrame={params.frame === "1"} initialView={params.view || "HAB"} initialPage={params.page || "DAY2"} initialEdition={params.edition || "workplace"} />;
}
