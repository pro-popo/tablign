import type { SupabaseClient } from "@supabase/supabase-js";

/** 저장된 테마 JSON(검증 전). 아직 저장한 적 없으면 null. */
export async function getThemeSettings(client: SupabaseClient, userId: string): Promise<unknown | null> {
  const { data, error } = await client
    .from("user_settings")
    .select("theme")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { theme: unknown } | null)?.theme ?? null;
}

export async function saveThemeSettings(client: SupabaseClient, userId: string, theme: unknown): Promise<void> {
  const { error } = await client
    .from("user_settings")
    .upsert({ user_id: userId, theme, updated_at: new Date().toISOString() });
  if (error) throw error;
}
