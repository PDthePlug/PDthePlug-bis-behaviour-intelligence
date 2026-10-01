import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";
import { ProgrammeEntry } from "@/app/habit/programme-entry";

export const dynamic = "force-dynamic";

type HandbookSearchParams = {
  facilitator?: string;
  group?: string;
  page?: string;
  returnTo?: string;
};

export default async function HandbookPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<HandbookSearchParams>;
}) {
  const { code } = await params;
  const query = await searchParams;
  if (!/^[a-z][a-z0-9_-]{1,11}$/.test(code)) notFound();

  const facilitatorMode = query.facilitator === "1";
  const facilitatorGroupId = facilitatorMode ? String(query.group ?? "") : "";
  const facilitatorReturnTo =
    facilitatorMode && typeof query.returnTo === "string" && query.returnTo.startsWith("/")
      ? query.returnTo
      : "/workspace?view=facilitator";

  if (code === "hab") {
    const params = new URLSearchParams({ section: "learn", module: "HAB" });
    if (query.page) params.set("page", query.page);
    if (facilitatorMode) {
      params.set("facilitator", "1");
      if (facilitatorGroupId) params.set("group", facilitatorGroupId);
      params.set("returnTo", facilitatorReturnTo);
    }
    redirect(`/habit?${params.toString()}`);
  }

  const user = await requireUser(`/handbooks/${code}`);
  return (
    <ProgrammeEntry
      moduleCode={code.toUpperCase()}
      initialSection="learn"
      initialLearnMode="reader"
      initialIdentity={{
        email: user.email,
        displayName:
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : user.email.split("@")[0],
      }}
      facilitatorMode={facilitatorMode}
      facilitatorGroupId={facilitatorGroupId}
      facilitatorReturnTo={facilitatorReturnTo}
    />
  );
}
