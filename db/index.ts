import { requestSupabaseClient, withSupabaseRequest } from "../lib/supabase/server";
import { SupabaseDatabase } from "./query";

export function getDb() {
  return new SupabaseDatabase(requestSupabaseClient());
}

export { withSupabaseRequest };
