import { ProgrammePlayer } from "../../../../../app/learning/programme-player";

export default async function Page({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const params = await searchParams;
  return <ProgrammePlayer moduleCode="LDR" initialSection={params.section === "learn" ? "learn" : "today"} initialLearnMode="reader" />;
}
