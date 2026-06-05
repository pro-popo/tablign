import type { SupabaseClient } from "@supabase/supabase-js";
import type { Space } from "../types";

export interface CreateSpaceInput {
  user_id: string;
  name: string;
  icon?: string | null;
  position?: number;
}

export async function listSpaces(client: SupabaseClient): Promise<Space[]> {
  const { data, error } = await client
    .from("spaces")
    .select()
    .order("position", { ascending: true });
  if (error) throw error;
  return data as Space[];
}

export async function createSpace(
  client: SupabaseClient,
  input: CreateSpaceInput,
): Promise<Space> {
  const { data, error } = await client
    .from("spaces")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Space;
}

export async function updateSpace(
  client: SupabaseClient,
  id: string,
  patch: Partial<Pick<Space, "name" | "icon" | "position">>,
): Promise<Space> {
  const { data, error } = await client
    .from("spaces")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Space;
}

export async function deleteSpace(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("spaces").delete().eq("id", id);
  if (error) throw error;
}
