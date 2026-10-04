export function writeResponseBatches<T extends { investigation?: unknown; semanticFieldId?: unknown }>(items: T[], write: (item: T) => Promise<unknown>): Promise<void>;
