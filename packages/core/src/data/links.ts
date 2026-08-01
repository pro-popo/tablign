import type { SupabaseClient } from "@supabase/supabase-js";
import type { Link } from "../types";

export interface CreateLinkInput {
  user_id: string;
  collection_id: string;
  url: string;
  title?: string | null;
  favicon_url?: string | null;
  thumbnail_url?: string | null;
  custom_title?: string | null;
  note?: string | null;
  position?: number;
}

export async function listLinks(
  client: SupabaseClient,
  collectionId: string,
): Promise<Link[]> {
  const { data, error } = await client
    .from("links")
    .select()
    .eq("collection_id", collectionId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Link[];
}

export async function createLink(
  client: SupabaseClient,
  input: CreateLinkInput,
): Promise<Link> {
  const { data, error } = await client
    .from("links")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Link;
}

/**
 * 링크 여러 개를 한 번의 요청으로 저장한다.
 *
 * createLink를 루프로 돌리면 탭 수만큼 왕복이 생겨(탭 30개 = 왕복 30회) 수 초가 걸린다.
 * 배열 insert는 왕복 1회로 끝나고, 부분 실패 없이 전부 성공하거나 전부 실패한다 —
 * "12개 담았다고 했는데 9개만 들어간" 상태가 아예 생기지 않는다.
 *
 * 빈 배열이면 요청을 보내지 않고 빈 배열을 돌려준다.
 */
export async function createLinks(
  client: SupabaseClient,
  inputs: CreateLinkInput[],
): Promise<Link[]> {
  if (inputs.length === 0) return [];
  const { data, error } = await client
    .from("links")
    .insert(inputs)
    .select();
  if (error) throw error;
  return data as Link[];
}

export async function updateLink(
  client: SupabaseClient,
  id: string,
  patch: Partial<
    Pick<Link, "title" | "custom_title" | "url" | "favicon_url" | "thumbnail_url" | "note" | "position">
  >,
): Promise<Link> {
  const { data, error } = await client
    .from("links")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Link;
}

export async function moveLink(
  client: SupabaseClient,
  id: string,
  collectionId: string,
  position: number,
): Promise<Link> {
  const { data, error } = await client
    .from("links")
    .update({ collection_id: collectionId, position })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Link;
}

export async function deleteLink(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("links").delete().eq("id", id);
  if (error) throw error;
}
