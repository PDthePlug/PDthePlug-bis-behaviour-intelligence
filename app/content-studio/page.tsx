import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/require-user";
import { ContentStudio } from "./content-studio";
import "./content-studio.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  alternates: { canonical: "/content-studio" },
  title: "BIS Content Studio",
  description: "Super User workspace for BIS learning modules and Labs.",
};

export default async function ContentStudioPage() {
  await requireUser("/content-studio");
  return <ContentStudio />;
}
