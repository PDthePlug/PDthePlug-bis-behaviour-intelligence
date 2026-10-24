import { ProgrammePlayer } from "../../../../../app/learning/programme-player";

export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = "HAB" } = await searchParams;
  return <ProgrammePlayer moduleCode={code} initialSection="learn" initialLearnMode="reader" />;
}
