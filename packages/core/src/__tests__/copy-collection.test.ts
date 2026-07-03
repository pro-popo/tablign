import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";

// .env.test 로드 (간단 파서)
const envText = readFileSync(resolve(__dirname, "../../.env.test"), "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const URL = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

async function makeUser(email: string): Promise<{ client: SupabaseClient; id: string }> {
  const admin = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password: "password123", email_confirm: true,
  });
  if (createErr) throw createErr;
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: "password123" });
  if (signInErr) throw signInErr;
  return { client, id: created.user!.id };
}

describe("copy_collection RPC", () => {
  let alice: { client: SupabaseClient; id: string };
  let bob: { client: SupabaseClient; id: string };
  let srcSpaceId: string;   // alice의 원본 스페이스
  let dstSpaceId: string;   // alice의 대상 스페이스
  let srcColId: string;     // 링크 2개를 가진 원본 컬렉션
  let bobSpaceId: string;   // bob의 스페이스

  beforeAll(async () => {
    alice = await makeUser(`copy-alice-${Date.now()}@test.local`);
    bob = await makeUser(`copy-bob-${Date.now()}@test.local`);

    const { data: s1 } = await alice.client.from("spaces")
      .insert({ user_id: alice.id, name: "원본" }).select().single();
    const { data: s2 } = await alice.client.from("spaces")
      .insert({ user_id: alice.id, name: "대상" }).select().single();
    srcSpaceId = s1!.id; dstSpaceId = s2!.id;

    const { data: c } = await alice.client.from("collections")
      .insert({ user_id: alice.id, space_id: srcSpaceId, title: "읽을거리", icon: "📚", note: "메모" })
      .select().single();
    srcColId = c!.id;

    await alice.client.from("links").insert([
      { user_id: alice.id, collection_id: srcColId, url: "https://a.com", title: "A", position: 1000 },
      { user_id: alice.id, collection_id: srcColId, url: "https://b.com", title: "B", note: "b메모", position: 2000 },
    ]);

    const { data: bs } = await bob.client.from("spaces")
      .insert({ user_id: bob.id, name: "Bob 스페이스" }).select().single();
    bobSpaceId = bs!.id;
  });

  it("컬렉션과 링크를 대상 스페이스로 딥카피하고 새 id를 반환한다", async () => {
    const { data: newId, error } = await alice.client.rpc("copy_collection", {
      p_collection_id: srcColId, p_target_space_id: dstSpaceId,
    });
    expect(error).toBeNull();
    expect(newId).toBeTruthy();
    expect(newId).not.toBe(srcColId);

    const { data: copied } = await alice.client.from("collections").select().eq("id", newId).single();
    expect(copied!.space_id).toBe(dstSpaceId);
    expect(copied!.title).toBe("읽을거리");
    expect(copied!.icon).toBe("📚");
    expect(copied!.note).toBe("메모");
    expect(copied!.user_id).toBe(alice.id);

    const { data: links } = await alice.client.from("links")
      .select().eq("collection_id", newId).order("position");
    expect(links!.map((l) => l.url)).toEqual(["https://a.com", "https://b.com"]);
    expect(links![1].note).toBe("b메모");
  });

  it("복사본은 대상 스페이스 맨 아래 position을 받는다", async () => {
    // 대상 스페이스에 position 5000짜리 컬렉션을 먼저 만들어 둔다
    await alice.client.from("collections")
      .insert({ user_id: alice.id, space_id: dstSpaceId, title: "기존", position: 5000 });
    const { data: newId } = await alice.client.rpc("copy_collection", {
      p_collection_id: srcColId, p_target_space_id: dstSpaceId,
    });
    const { data: copied } = await alice.client.from("collections").select().eq("id", newId).single();
    expect(copied!.position).toBeGreaterThan(5000);
  });

  it("복사본을 수정해도 원본은 바뀌지 않는다", async () => {
    const { data: newId } = await alice.client.rpc("copy_collection", {
      p_collection_id: srcColId, p_target_space_id: dstSpaceId,
    });
    await alice.client.from("collections").update({ title: "변경됨" }).eq("id", newId);
    const { data: original } = await alice.client.from("collections").select().eq("id", srcColId).single();
    expect(original!.title).toBe("읽을거리");
  });

  it("남의 컬렉션은 복사할 수 없다", async () => {
    const { error } = await bob.client.rpc("copy_collection", {
      p_collection_id: srcColId, p_target_space_id: bobSpaceId,
    });
    expect(error).not.toBeNull();
  });

  it("남의 스페이스로는 복사할 수 없다", async () => {
    const { error } = await alice.client.rpc("copy_collection", {
      p_collection_id: srcColId, p_target_space_id: bobSpaceId,
    });
    expect(error).not.toBeNull();
  });
});
