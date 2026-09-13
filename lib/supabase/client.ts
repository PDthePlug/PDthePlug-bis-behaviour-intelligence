"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseBrowserConfig } from "./config";

export function createClient() {
  const { url, publishableKey } = supabaseBrowserConfig();
  return createBrowserClient(url, publishableKey);
}
