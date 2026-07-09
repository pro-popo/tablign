import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpaceMember, MemberWithProfile } from "../types";

/** 스페이스 멤버 목록(프로필 join, position 오름차순). editor/viewer만 — 오너는 포함되지 않는다.
 *  space_members.user_id → auth.users FK 이므로 PostgREST profiles 직접 조인 불가.
 *  멤버 목록 조회 후 profiles를 별도 쿼리로 merge한다.
 */
export async function listMembers(client: SupabaseClient, spaceId: string): Promise<MemberWithProfile[]> {
  const { data: members, error } = await client
    .from("space_members")
    .select("space_id, user_id, role, position, created_at")
    .eq("space_id", spaceId)
    .order("position", { ascending: true });
  if (error) throw error;
  if (!members || members.length === 0) return [];

  const userIds = members.map((m: SpaceMember) => m.user_id);
  const { data: profiles, error: profilesError } = await client
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);
  if (profilesError) throw profilesError;

  const profileMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
  for (const p of profiles ?? []) {
    const pr = p as { id: string; display_name: string | null; avatar_url: string | null };
    profileMap.set(pr.id, { display_name: pr.display_name, avatar_url: pr.avatar_url });
  }

  return (members as SpaceMember[]).map((m) => ({
    ...m,
    display_name: profileMap.get(m.user_id)?.display_name ?? null,
    avatar_url: profileMap.get(m.user_id)?.avatar_url ?? null,
  }));
}

/** 멤버 제거(오너) 또는 본인 강제 제거. */
export async function removeMember(client: SupabaseClient, spaceId: string, userId: string): Promise<void> {
  const { error } = await client.from("space_members").delete().eq("space_id", spaceId).eq("user_id", userId);
  if (error) throw error;
}

/** 멤버 역할 변경(오너만 — role 가드 트리거가 강제). */
export async function updateMemberRole(client: SupabaseClient, spaceId: string, userId: string, role: "editor" | "viewer"): Promise<void> {
  const { error } = await client.from("space_members").update({ role }).eq("space_id", spaceId).eq("user_id", userId);
  if (error) throw error;
}

/** 내 사이드바 "공유됨" 섹션에서의 순서 변경(본인 행). */
export async function updateMemberPosition(client: SupabaseClient, spaceId: string, userId: string, position: number): Promise<void> {
  const { error } = await client.from("space_members").update({ position }).eq("space_id", spaceId).eq("user_id", userId);
  if (error) throw error;
}

/** 스페이스에서 나가기(본인 행 삭제). */
export async function leaveSpace(client: SupabaseClient, spaceId: string, userId: string): Promise<void> {
  const { error } = await client.from("space_members").delete().eq("space_id", spaceId).eq("user_id", userId);
  if (error) throw error;
}

/** 내가 멤버(editor/viewer)로 속한 스페이스 목록 — 사이드바 "공유됨" 섹션용. */
export async function listMyMemberships(client: SupabaseClient): Promise<SpaceMember[]> {
  const { data, error } = await client
    .from("space_members")
    .select("space_id, user_id, role, position, created_at")
    .order("position", { ascending: true });
  if (error) throw error;
  return data as SpaceMember[];
}
