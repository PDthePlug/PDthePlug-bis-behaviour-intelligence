export const explorationStorageKey: string;
export function explorationHref(href: string): string;
export function createExplorationSession(content: {lab: unknown; programme: unknown}, report: unknown, history?: unknown): {
  state: { facilitator: unknown; sponsor: unknown; actions: unknown[] };
  request: (role: string, input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  execute: (role: string, endpoint: string, body: Record<string, unknown>) => unknown;
  labSnapshot: () => { enrolment: null | {experimentStartedAt?: string | null}; experimentTiming: {availableDay: number; totalDays: number} };
};
