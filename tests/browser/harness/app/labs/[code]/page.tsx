import { UniversalRuntimeLab } from "../../../../../../app/labs/[code]/universal-runtime-lab";

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <UniversalRuntimeLab labCode={code.toUpperCase()} />;
}
