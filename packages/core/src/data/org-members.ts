import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationMember, OrgMemberWithProfile } from "../types";

/** 조직 멤버 목록(프로필 join, position 오름차순). 오너는 미포함(members 테이블에 없음).
 *  organization_members.user_id → auth.users FK 이므로 PostgREST profiles 직접 조인 불가.
 *  멤버 목록 조회 후 profiles를 별도 쿼리로 merge한다.
 */
export async function listOrgMembers(client: SupabaseClient, orgId: string): Promise<OrgMemberWithProfile[]> {
  const { data: members, error } = await client
    .from("organization_members")
    .select("org_id, user_id, role, position, created_at")
    .eq("org_id", orgId)
    .order("position", { ascending: true });
  if (error) throw error;
  if (!members || members.length === 0) return [];

  const userIds = (members as OrganizationMember[]).map((m) => m.user_id);
  const { data: profiles, error: pErr } = await client
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);
  if (pErr) throw pErr;

  const map = new Map<string, { display_name: string | null; avatar_url: string | null }>();
  for (const p of profiles ?? []) {
    const pr = p as { id: string; display_name: string | null; avatar_url: string | null };
    map.set(pr.id, { display_name: pr.display_name, avatar_url: pr.avatar_url });
  }

  return (members as OrganizationMember[]).map((m) => ({
    ...m,
    display_name: map.get(m.user_id)?.display_name ?? null,
    avatar_url: map.get(m.user_id)?.avatar_url ?? null,
  }));
}

/** 멤버 제거(오너/admin) 또는 본인 강제 제거. */
export async function removeOrgMember(client: SupabaseClient, orgId: string, userId: string): Promise<void> {
  const { error } = await client.from("organization_members").delete().eq("org_id", orgId).eq("user_id", userId);
  if (error) throw error;
}

/** 멤버 역할 변경(오너/admin — role 가드 트리거가 강제). */
export async function updateOrgMemberRole(client: SupabaseClient, orgId: string, userId: string, role: "admin" | "member"): Promise<void> {
  const { error } = await client.from("organization_members").update({ role }).eq("org_id", orgId).eq("user_id", userId);
  if (error) throw error;
}

/** 조직에서 나가기(본인 행 삭제). */
export async function leaveOrg(client: SupabaseClient, orgId: string, userId: string): Promise<void> {
  const { error } = await client.from("organization_members").delete().eq("org_id", orgId).eq("user_id", userId);
  if (error) throw error;
}
