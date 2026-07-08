import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";
import { copyCollection, moveCollectionToSpace } from "../data/collections";

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

// Fixture variables shared by both describe blocks
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

describe("copy_collection RPC", () => {

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
    expect(copied!.position).toBe(6000);
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

  it("링크 없는 컬렉션도 복사된다", async () => {
    // 링크가 0개인 컬렉션을 별도로 만들어 복사한다
    const { data: emptyCol } = await alice.client.from("collections")
      .insert({ user_id: alice.id, space_id: srcSpaceId, title: "빈 컬렉션", position: 9000 })
      .select().single();
    const { data: newId, error } = await alice.client.rpc("copy_collection", {
      p_collection_id: emptyCol!.id, p_target_space_id: dstSpaceId,
    });
    expect(error).toBeNull();
    expect(newId).toBeTruthy();
    const { data: copied } = await alice.client.from("collections").select().eq("id", newId).single();
    expect(copied!.space_id).toBe(dstSpaceId);
    const { data: links } = await alice.client.from("links").select().eq("collection_id", newId);
    expect(links).toHaveLength(0);
  });

  it("빈 스페이스로 복사하면 position 1000을 받는다", async () => {
    // 완전히 새로운 빈 스페이스를 만들어 복사한다 — 기존 dstSpaceId와 독립
    const { data: emptySpace } = await alice.client.from("spaces")
      .insert({ user_id: alice.id, name: "빈 스페이스" }).select().single();
    const emptySpaceId = emptySpace!.id;
    const { data: newId, error } = await alice.client.rpc("copy_collection", {
      p_collection_id: srcColId, p_target_space_id: emptySpaceId,
    });
    expect(error).toBeNull();
    const { data: copied } = await alice.client.from("collections").select().eq("id", newId).single();
    expect(copied!.position).toBe(1000);
  });
});

describe("copyCollection / moveCollectionToSpace (core)", () => {
  it("copyCollection이 새 컬렉션 id를 반환한다", async () => {
    const newId = await copyCollection(alice.client, srcColId, dstSpaceId);
    expect(typeof newId).toBe("string");
    const { data } = await alice.client.from("collections").select().eq("id", newId).single();
    expect(data!.space_id).toBe(dstSpaceId);
  });

  it("moveCollectionToSpace가 컬렉션을 대상 스페이스 맨 아래로 옮긴다", async () => {
    // 이동용 컬렉션을 원본 스페이스에 새로 만든다 (srcColId는 다른 테스트가 쓰므로 건드리지 않음)
    const { data: c } = await alice.client.from("collections")
      .insert({ user_id: alice.id, space_id: srcSpaceId, title: "이동할 것", position: 1000 })
      .select().single();
    // 대상 스페이스의 현재 최대 position 파악
    const { data: before } = await alice.client.from("collections")
      .select("position").eq("space_id", dstSpaceId)
      .order("position", { ascending: false }).limit(1);
    const maxBefore = before?.[0]?.position ?? 0;

    await moveCollectionToSpace(alice.client, c!.id, dstSpaceId);

    // 이동된 컬렉션을 직접 조회해 검증
    const { data: moved } = await alice.client.from("collections").select().eq("id", c!.id).single();
    expect(moved!.space_id).toBe(dstSpaceId);
    expect(moved!.position).toBeGreaterThan(maxBefore);

    // 원본 스페이스에서는 사라진다
    const { data: remain } = await alice.client.from("collections")
      .select().eq("space_id", srcSpaceId).eq("id", c!.id);
    expect(remain).toHaveLength(0);
    // 링크는 컬렉션을 따라간다 (collection_id 불변이므로 자동)
  });

  it("남의 스페이스로는 이동할 수 없다", async () => {
    // alice의 컬렉션을 bob의 스페이스로 이동 시도 → 거부되어야 한다
    const { data: c } = await alice.client.from("collections")
      .insert({ user_id: alice.id, space_id: srcSpaceId, title: "이동 거부 테스트", position: 2000 })
      .select().single();
    const thatId = c!.id;

    await expect(moveCollectionToSpace(alice.client, thatId, bobSpaceId)).rejects.toBeTruthy();

    // 이동 실패 후 컬렉션은 여전히 원본 스페이스에 있어야 한다
    const { data: check } = await alice.client.from("collections")
      .select().eq("id", thatId).single();
    expect(check!.space_id).toBe(srcSpaceId);
  });
});
