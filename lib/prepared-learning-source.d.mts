export function loadPreparedLearningSource(code: string, edition: string, root?: string): Promise<{
  bytes: Uint8Array;
  sourceVersion: string;
  entry: { code: string; title: string; edition: string; sourceId: string; sectionHash: string; packageHash: string; asset: string };
}>;
