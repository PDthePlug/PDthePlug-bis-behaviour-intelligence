// Keep application validation messages; transport and decoding errors need an action.
export class ClientResponseError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function readClientResponse<T>(response: Response, fallback: string, valid?: (payload: Record<string, unknown>) => boolean): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object" || Array.isArray(payload) || (valid && !valid(payload))) {
    throw new ClientResponseError(!response.ok && typeof payload?.error === "string" ? payload.error : fallback, response.status);
  }
  return payload as T;
}

export function clientResponseMessage(cause: unknown, fallback: string) {
  return cause instanceof ClientResponseError ? cause.message : fallback;
}

export function clientResponseDenied(cause: unknown) {
  return cause instanceof ClientResponseError && [401, 403].includes(cause.status);
}
