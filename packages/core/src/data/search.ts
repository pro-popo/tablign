import type { SupabaseClient } from "@supabase/supabase-js";
import type { Link } from "../types";

/** 검색 결과에 함께 보여줄 스페이스 요약 정보 */
export interface SpaceSummary {
  id: string;
  name: string;
  icon: string | null;
}

/** 링크 검색 결과: 소속 컬렉션과 그 스페이스 정보를 함께 담는다 */
export interface LinkSearchResult extends Link {
  collection: { title: string; space: SpaceSummary };
}

/** PostgREST or 필터에서 쓰는 특수문자를 제거해 안전하게 만든다 */
function sanitize(query: string): string {
  return query.trim().replace(/[%,()]/g, "");
}

/** 링크를 제목·별칭·주소로 찾는다. 범위는 orgId 조직의 스페이스로 한정한다. */
export async function searchLinks(
  client: SupabaseClient,
  query: string,
  orgId: string,
): Promise<LinkSearchResult[]> {
  const q = sanitize(query);
  if (!q) return [];
  const { data, error } = await client
    .from("links")
    .select("*, collection:collections!inner(title, space:spaces!inner(id, name, icon))")
    .eq("collection.space.org_id", orgId)
    .or(`title.ilike.%${q}%,custom_title.ilike.%${q}%,url.ilike.%${q}%`)
    .limit(50);
  if (error) throw error;
  return data as unknown as LinkSearchResult[];
}
