import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpaceInvitation, InvitationWithSpace } from "../types";

/** 이메일로 스페이스에 초대(오너). 초대 id 반환. */
export async function inviteToSpace(client: SupabaseClient, spaceId: string, email: string, role: "editor" | "viewer"): Promise<string> {
  const { data, error } = await client.rpc("invite_to_space", { p_space_id: spaceId, p_email: email, p_role: role });
  if (error) throw error;
  return data as string;
}

/** 스페이스의 대기 중(pending) 초대 목록(오너 — 멤버 관리 다이얼로그용). */
export async function listSpaceInvitations(client: SupabaseClient, spaceId: string): Promise<SpaceInvitation[]> {
  const { data, error } = await client
    .from("space_invitations").select().eq("space_id", spaceId).eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as SpaceInvitation[];
}

/** 나에게 온 pending 초대 목록(스페이스 이름 포함) — 알림 배지용.
 *  초대받은 사람은 아직 space_members에 없어 spaces RLS를 통과하지 못하므로
 *  security definer RPC get_my_invitations()를 통해 스페이스 이름을 취득한다.
 *  inviter_name: inviter_id → auth.users FK 때문에 PostgREST profiles 조인 불가 → null.
 */
export async function listMyInvitations(client: SupabaseClient): Promise<InvitationWithSpace[]> {
  const { data, error } = await client.rpc("get_my_invitations");
  if (error) throw error;
  return (data as unknown[]).map((row) => {
    const r = row as SpaceInvitation & { space_name: string };
    return { ...r, space_name: r.space_name ?? "", inviter_name: null };
  });
}

export async function acceptInvitation(client: SupabaseClient, invitationId: string): Promise<void> {
  const { error } = await client.rpc("accept_invitation", { p_invitation_id: invitationId });
  if (error) throw error;
}

export async function declineInvitation(client: SupabaseClient, invitationId: string): Promise<void> {
  const { error } = await client.rpc("decline_invitation", { p_invitation_id: invitationId });
  if (error) throw error;
}

/** 오너가 대기 중 초대를 취소(delete). */
export async function cancelInvitation(client: SupabaseClient, invitationId: string): Promise<void> {
  const { error } = await client.from("space_invitations").delete().eq("id", invitationId).eq("status", "pending");
  if (error) throw error;
}
