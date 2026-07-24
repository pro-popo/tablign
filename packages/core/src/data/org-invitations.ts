import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationInvitation, OrgInvitationWithOrg } from "../types";

/** 이메일로 조직에 초대(오너/admin). 초대 id 반환. */
export async function inviteToOrg(client: SupabaseClient, orgId: string, email: string, role: "admin" | "member"): Promise<string> {
  const { data, error } = await client.rpc("invite_to_org", { p_org_id: orgId, p_email: email, p_role: role });
  if (error) throw error;
  return data as string;
}

/** 조직의 대기 중(pending) 초대 목록(오너/admin — 멤버 관리 다이얼로그용). */
export async function listOrgInvitations(client: SupabaseClient, orgId: string): Promise<OrganizationInvitation[]> {
  const { data, error } = await client
    .from("organization_invitations").select().eq("org_id", orgId).eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as OrganizationInvitation[];
}

/** 나에게 온 pending 조직 초대 목록(조직 이름 포함) — 알림 배지용.
 *  초대받은 사람은 아직 organization_members에 없어 organizations RLS를 통과하지 못하므로
 *  security definer RPC get_my_org_invitations()를 통해 조직 이름을 취득한다.
 *  inviter_name: inviter_id → auth.users FK 때문에 PostgREST profiles 조인 불가 → null.
 */
export async function listMyOrgInvitations(client: SupabaseClient): Promise<OrgInvitationWithOrg[]> {
  const { data, error } = await client.rpc("get_my_org_invitations");
  if (error) throw error;
  return (data as unknown[]).map((row) => {
    const r = row as OrganizationInvitation & { org_name: string };
    return { ...r, org_name: r.org_name ?? "", inviter_name: null };
  });
}

export async function acceptOrgInvitation(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc("accept_org_invitation", { p_invitation_id: id });
  if (error) throw error;
}

export async function declineOrgInvitation(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc("decline_org_invitation", { p_invitation_id: id });
  if (error) throw error;
}

/** 오너/admin이 대기 중 초대를 취소(delete). */
export async function cancelOrgInvitation(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("organization_invitations").delete().eq("id", id).eq("status", "pending");
  if (error) throw error;
}
