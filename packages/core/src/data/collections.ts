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
