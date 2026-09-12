import { AsyncLocalStorage } from "node:async_hooks";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseBrowserConfig } from "./config";

const requestStorage = new AsyncLocalStorage<SupabaseClient>();

export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = supabaseBrowserConfig();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. The root proxy owns refreshes.
        }
      },
    },
  });
}

export async function withSupabaseRequest<T>(work: () => Promise<T>) {
  const client = await createClient();
  return requestStorage.run(client, work);
}

export function requestSupabaseClient() {
  const client = requestStorage.getStore();
  if (!client) {
    throw new Error("BIS database access must run inside an authenticated request context.");
  }
  return client;
}
