import type { SupabaseClient } from "@supabase/supabase-js";

export interface ShareCode {
  code: string;
  expires_at: string | null;
}

export interface ShareCodeInfo {
  title: string;
  icon: string | null;
  link_count: number;
  shared_by: string | null;
}

/** 컬렉션 공유 코드를 발급한다. 활성 코드가 있으면 그것을 반환. expiresInDays null=무기한(기본 7일). */
export async function createCollectionShareCode(
  client: SupabaseClient,
  collectionId: string,
  expiresInDays: number | null = 7,
): Promise<ShareCode> {
  const { data, error } = await client.rpc("create_collection_share_code", {
    p_collection_id: collectionId,
    p_expires_in_days: expiresInDays,
  });
  if (error) throw error;
  return (data as ShareCode[])[0];
}

/** 발급자가 코드를 회수한다(이후 조회·가져오기 불가). */
export async function revokeCollectionShareCode(client: SupabaseClient, code: string): Promise<void> {
  const { error } = await client
    .from("collection_share_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("code", code);
  if (error) throw error;
}

/** 코드의 미리보기 정보(컬렉션 이름·링크 수·공유한 사람). 만료·회수·미존재면 throw. */
export async function getShareCodeInfo(client: SupabaseClient, code: string): Promise<ShareCodeInfo> {
  const { data, error } = await client.rpc("get_share_code_info", { p_code: code });
  if (error) throw error;
  const row = (data as (Omit<ShareCodeInfo, "link_count"> & { link_count: number | string })[])[0];
  return { ...row, link_count: Number(row.link_count) };
}

/** 코드로 컬렉션을 대상 스페이스에 스냅샷 복사하고 새 컬렉션 id를 반환한다. */
export async function importCollectionByCode(
  client: SupabaseClient,
  code: string,
  targetSpaceId: string,
): Promise<string> {
  const { data, error } = await client.rpc("import_collection_by_code", {
    p_code: code,
    p_target_space_id: targetSpaceId,
  });
  if (error) throw error;
  return data as string;
}
