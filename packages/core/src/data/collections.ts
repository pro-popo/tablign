import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection } from "../types";

export interface CreateCollectionInput {
  user_id: string;
  space_id: string;
  title: string;
  icon?: string | null;
  note?: string | null;
  position?: number;
}

export async function listCollections(
  client: SupabaseClient,
  spaceId: string,
): Promise<Collection[]> {
  const { data, error } = await client
    .from("collections")
    .select()
    .eq("space_id", spaceId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data as Collection[];
}

export async function listAllCollections(
  client: SupabaseClient,
): Promise<Collection[]> {
  const { data, error } = await client
    .from("collections")
    .select()
    .order("position", { ascending: true });
  if (error) throw error;
  return data as Collection[];
}

export async function createCollection(
  client: SupabaseClient,
  input: CreateCollectionInput,
): Promise<Collection> {
  const { data, error } = await client
    .from("collections")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Collection;
}

export async function updateCollection(
  client: SupabaseClient,
  id: string,
  patch: Partial<Pick<Collection, "title" | "icon" | "note" | "position" | "space_id">>,
): Promise<Collection> {
  const { data, error } = await client
    .from("collections")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Collection;
}

export async function deleteCollection(
  client: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await client.from("collections").delete().eq("id", id);
  if (error) throw error;
}

/** 컬렉션을 대상 스페이스로 딥카피(링크 포함, 태그 제외)하고 새 컬렉션 id를 반환한다. */
export async function copyCollection(
  client: SupabaseClient,
  collectionId: string,
  targetSpaceId: string,
): Promise<string> {
  const { data, error } = await client.rpc("copy_collection", {
    p_collection_id: collectionId,
    p_target_space_id: targetSpaceId,
  });
  if (error) throw error;
  return data as string;
}

/** 컬렉션을 대상 스페이스 맨 아래로 이동한다(원본·대상 소유권은 RPC가 검증). */
export async function moveCollectionToSpace(
  client: SupabaseClient,
  collectionId: string,
  targetSpaceId: string,
): Promise<void> {
  const { error } = await client.rpc("move_collection", {
    p_collection_id: collectionId,
    p_target_space_id: targetSpaceId,
  });
  if (error) throw error;
}
