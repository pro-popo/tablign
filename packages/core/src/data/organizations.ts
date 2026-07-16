import type { SupabaseClient } from "@supabase/supabase-js";
import type { Organization, OrganizationMember } from "../types";

/** 내가 접근 가능한 모든 조직(개인 + 팀). RLS가 필터. */
export async function listOrganizations(client: SupabaseClient): Promise<Organization[]> {
  const { data, error } = await client.from("organizations").select().order("created_at", { ascending: true });
  if (error) throw error;
  return data as Organization[];
}

export async function createOrganization(
  client: SupabaseClient,
  input: { name: string; owner_id: string; icon?: string | null; color?: string | null },
): Promise<Organization> {
  const { data, error } = await client.from("organizations").insert(input).select().single();
  if (error) throw error;
  return data as Organization;
}

export async function updateOrganization(
  client: SupabaseClient,
  id: string,
  patch: Partial<Pick<Organization, "name" | "icon" | "color">>,
): Promise<Organization> {
  const { data, error } = await client.from("organizations").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Organization;
}

export async function deleteOrganization(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("organizations").delete().eq("id", id);
  if (error) throw error;
}

/** 내가 admin/member로 속한 조직 멤버십 — 역할 판정·레일 순서용. */
export async function listMyOrgMemberships(client: SupabaseClient): Promise<OrganizationMember[]> {
  const { data, error } = await client
    .from("organization_members")
    .select("org_id, user_id, role, position, created_at")
    .order("position", { ascending: true });
  if (error) throw error;
  return data as OrganizationMember[];
}
