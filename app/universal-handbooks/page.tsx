import { readFile } from "node:fs/promises";
import path from "node:path";
import { UniversalHandbookReader } from "./universal-handbook-reader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Universal Handbook Player", robots: { index: false, follow: false } };
type Manifest = { source:{filename:string;bytes:number;sha256:string;downloadAsset?:string}; editions:Array<{family:string;slug:string;audience:string;title:string;ordinalInFamily:number;sourceHeadingType?:string;asset:string;blockCount:number;sourceStartBlock:number;sourceEndBlock:number}> };

export default async function UniversalHandbooksPage() {
 let manifest:Manifest|null=null;
 try { manifest=JSON.parse(await readFile(path.join(process.cwd(),"public/handbooks/canonical/manifest.json"),"utf8")) as Manifest; } catch { /* Keep the source gate visible until canonical packages exist. */ }
 if(!manifest) return <main className="uh-gate"><p className="uh-eyebrow">BIS · SOURCE GATE</p><h1>Universal Handbook Player</h1><p>The reader shell is in place, but canonical source packages have not been generated in this deployment.</p><ol><li>Make the byte-identical supplied manuscript available to the source workspace.</li><li>Run the canonical DOCX importer to generate packages and the manifest.</li><li>Resolve source-boundary anomalies with the content owner, then run source-to-rendered checks.</li></ol><p>Legacy handbook packages are deliberately not used as a substitute.</p></main>;
 return <UniversalHandbookReader manifest={manifest}/>;
}
