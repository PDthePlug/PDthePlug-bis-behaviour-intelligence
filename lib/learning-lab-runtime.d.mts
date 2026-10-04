export function loadLearningLabRuntime(code: string, fetcher: typeof fetch, signal?: AbortSignal): Promise<Record<string, unknown> | null>;
export function universalLearningKnownValues(runtime: unknown): Array<{ labels: string[]; value: string; exact: boolean; source: string }>;
