import type { SupabaseClient } from "@supabase/supabase-js";
import type { Space } from "../types";
import type { ExportSpace } from "../import/toby";

type Row = { space_id: string; title: string; links: ExportSpace["collections"][number]["links"] };

/** 고른 스페이스의 컬렉션·링크를 한 번에 읽어 내보내기 형태로 묶는다. 스페이스는 받은 순서 그대로. */
export async function loadSpacesForExport(
  client: SupabaseClient,
  spaces: Pick<Space, "id" | "name">[],
): Promise<ExportSpace[]> {
  const { data, error } = await client
    .from("collections")
    .select("space_id, title, links(url, title, custom_title, favicon_url)")
    .in("space_id", spaces.map((s) => s.id))
    .order("position")
    .order("created_at")
    .order("position", { referencedTable: "links" })
    .order("created_at", { referencedTable: "links" });
  if (error) throw error;
  const rows = data as Row[];
  return spaces.map((s) => ({
    name: s.name,
    collections: rows.filter((r) => r.space_id === s.id).map(({ title, links }) => ({ title, links })),
  }));
}
