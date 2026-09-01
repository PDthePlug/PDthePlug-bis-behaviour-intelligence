interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface D1PreparedStatement {
  readonly __d1PreparedStatementBrand?: "D1PreparedStatement";
}

interface D1Result<T = unknown> {
  results?: T[];
  success?: boolean;
  error?: string;
  meta?: Record<string, unknown>;
}

interface D1Database {
  readonly __d1DatabaseBrand?: "D1Database";
}

declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
  };
}
