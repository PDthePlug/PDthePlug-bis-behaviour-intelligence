type Edition = { code: string; title: string; edition: string };
type Draft = { id: string; status: string; sourceFiles: unknown[] };
type Item = { id: string; code: string; kind: string; status: string };
export function prepareHandbookReplacements<T extends Item, D extends Draft>(options: {
  items: T[]; editions: Edition[];
  createDraft: (item: T) => Promise<D>;
  loadSource: (draft: D, edition: Edition) => Promise<Uint8Array>;
  saveSource: (draft: D, edition: Edition, bytes: Uint8Array) => Promise<void>;
  compile: (draft: D) => Promise<void>;
  onProgress?: (message: string) => void;
}): Promise<Array<{ code: string; versionId: string; editions: string[] }>>;
