import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseClient(
  url: string,
  key: string,
): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
