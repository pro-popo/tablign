import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportPlan } from "../import/types";

export interface ImportResult {
  space_ids: string[];
  first_space_id: string;
  links: number;
}

/**
 * 계획을 RPC 페이로드로 줄여 보낸다.
 * sourceId·synthetic·duplicatesDropped는 UI 표시용이므로 서버로 보내지 않는다.
 */
function toPayload(plan: ImportPlan) {
  return plan.spaces.map((s) => ({
    name: s.name,
    collections: s.collections.map((c) => ({
      title: c.title,
      links: c.links.map((l) => ({ url: l.url, title: l.title, favicon_url: l.favicon_url })),
    })),
  }));
}

/** 계획을 대상 조직에 단일 트랜잭션으로 삽입하고 요약을 반환한다. */
export async function importBookmarks(
  client: SupabaseClient,
  orgId: string,
  plan: ImportPlan,
): Promise<ImportResult> {
  const { data, error } = await client.rpc("import_bookmarks", {
    p_org_id: orgId,
    p_payload: toPayload(plan),
  });
  if (error) throw error;
  return data as ImportResult;
}
