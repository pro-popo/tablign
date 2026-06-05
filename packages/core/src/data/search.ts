import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection, Link } from "../types";

/** PostgREST or 필터에서 쓰는 특수문자를 제거해 안전하게 만든다 */
function sanitize(query: string): string {
  return query.trim().replace(/[%,()]/g, "");
}

export async function searchCollections(
  client: SupabaseClient,
  query: string,
): Promise<Collection[]> {
  const q = sanitize(query);
  if (!q) return [];
  const { data, error } = await client
    .from("collections")
    .select()
    .ilike("title", `%${q}%`)
    .limit(50);
  if (error) throw error;
  return data as Collection[];
}

export async function searchLinks(
  client: SupabaseClient,
  query: string,
): Promise<Link[]> {
  const q = sanitize(query);
  if (!q) return [];
  const { data, error } = await client
    .from("links")
    .select()
    .or(`title.ilike.%${q}%,custom_title.ilike.%${q}%,url.ilike.%${q}%`)
    .limit(50);
  if (error) throw error;
  return data as Link[];
}
