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
    .order("position", { ascending: true });
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

export async function updateLink(
  client: SupabaseClient,
  id: string,
  patch: Partial<
    Pick<Link, "title" | "custom_title" | "favicon_url" | "thumbnail_url" | "position">
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
