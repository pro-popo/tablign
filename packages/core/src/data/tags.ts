import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tag } from "../types";

export interface CreateTagInput {
  user_id: string;
  name: string;
  color?: string | null;
}

export async function listTags(client: SupabaseClient): Promise<Tag[]> {
  const { data, error } = await client.from("tags").select().order("name", { ascending: true });
  if (error) throw error;
  return data as Tag[];
}

export async function createTag(
  client: SupabaseClient,
  input: CreateTagInput,
): Promise<Tag> {
  const { data, error } = await client.from("tags").insert(input).select().single();
  if (error) throw error;
  return data as Tag;
}

export async function deleteTag(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("tags").delete().eq("id", id);
  if (error) throw error;
}

export async function addTagToCollection(
  client: SupabaseClient,
  collectionId: string,
  tagId: string,
): Promise<void> {
  const { error } = await client
    .from("collection_tags")
    .insert({ collection_id: collectionId, tag_id: tagId });
  if (error) throw error;
}

export async function removeTagFromCollection(
  client: SupabaseClient,
  collectionId: string,
  tagId: string,
): Promise<void> {
  const { error } = await client
    .from("collection_tags")
    .delete()
    .eq("collection_id", collectionId)
    .eq("tag_id", tagId);
  if (error) throw error;
}

export async function listTagsForCollection(
  client: SupabaseClient,
  collectionId: string,
): Promise<Tag[]> {
  const { data, error } = await client
    .from("collection_tags")
    .select("tags(*)")
    .eq("collection_id", collectionId);
  if (error) throw error;
  // PostgREST 중첩 select("tags(*)")의 반환 타입을 supabase-js가 정확히 좁히지 못해
  // unknown으로 받아 캐스팅한다. 런타임 형태는 { tags: Tag }.
  return (data ?? []).map((row: unknown) => (row as { tags: Tag }).tags).filter(Boolean);
}

export async function listCollectionIdsForTag(
  client: SupabaseClient,
  tagId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("collection_tags")
    .select("collection_id")
    .eq("tag_id", tagId);
  if (error) throw error;
  return (data ?? []).map((row: { collection_id: string }) => row.collection_id);
}
