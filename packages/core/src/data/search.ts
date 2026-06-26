import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection, Link } from "../types";

/** 검색 결과에 함께 보여줄 스페이스 요약 정보 */
export interface SpaceSummary {
  name: string;
  icon: string | null;
}

/** 컬렉션 검색 결과: 소속 스페이스 정보를 함께 담는다 */
export interface CollectionSearchResult extends Collection {
  space: SpaceSummary | null;
}

/** 링크 검색 결과: 소속 컬렉션과 그 스페이스 정보를 함께 담는다 */
export interface LinkSearchResult extends Link {
  collection: { title: string; space: SpaceSummary | null } | null;
}

/** PostgREST or 필터에서 쓰는 특수문자를 제거해 안전하게 만든다 */
function sanitize(query: string): string {
  return query.trim().replace(/[%,()]/g, "");
}

export async function searchCollections(
  client: SupabaseClient,
  query: string,
): Promise<CollectionSearchResult[]> {
  const q = sanitize(query);
  if (!q) return [];
  const { data, error } = await client
    .from("collections")
    .select("*, space:spaces(name, icon)")
    .ilike("title", `%${q}%`)
    .limit(50);
  if (error) throw error;
  return data as unknown as CollectionSearchResult[];
}

export async function searchLinks(
  client: SupabaseClient,
  query: string,
): Promise<LinkSearchResult[]> {
  const q = sanitize(query);
  if (!q) return [];
  const { data, error } = await client
    .from("links")
    .select("*, collection:collections(title, space:spaces(name, icon))")
    .or(`title.ilike.%${q}%,custom_title.ilike.%${q}%,url.ilike.%${q}%`)
    .limit(50);
  if (error) throw error;
  return data as unknown as LinkSearchResult[];
}
