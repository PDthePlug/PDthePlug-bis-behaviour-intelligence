import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

/** Run the real TypeScript adapter/compiler in Node without a Next.js server. */
export async function loadContentTools() {
  const root = new URL("../../", import.meta.url);
  const temp = await mkdtemp(join(tmpdir(), "bis-source-integrity-"));
  for (const name of ["learning-foundation", "content-studio", "content-source-adapters", "content-compiler", "content-uat"]) {
    let source = await readFile(new URL(`lib/${name}.ts`, root), "utf8");
    if (name === "content-source-adapters") {
      const manifest = await readFile(new URL("lib/bis-volume-migration-manifest.json", root), "utf8");
      source = source.replace('await import("./bis-volume-migration-manifest.json")', `({ default: ${manifest} })`);
    }
    let compiled = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;
    compiled = compiled.replace(/from "(\.\/[^"\n]+)"/g, (_, target) => {
      const resolved = target.endsWith(".mjs")
        ? new URL(`lib/${target.slice(2)}`, root).href
        : pathToFileURL(join(temp, `${target.slice(2)}.mjs`)).href;
      return `from "${resolved}"`;
    });
    await writeFile(join(temp, `${name}.mjs`), compiled);
  }
  const adapter = await import(pathToFileURL(join(temp, "content-source-adapters.mjs")).href);
  const compiler = await import(pathToFileURL(join(temp, "content-compiler.mjs")).href);
  const uat = await import(pathToFileURL(join(temp, "content-uat.mjs")).href);
  return { ...adapter, ...compiler, ...uat, dispose: () => rm(temp, { recursive: true, force: true }) };
}
