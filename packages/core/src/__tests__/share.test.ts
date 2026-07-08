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

// 파일 최상위 공유 픽스처: alice(발급자), bob(가져가는 사람)
let alice: { client: SupabaseClient; id: string };
let bob: { client: SupabaseClient; id: string };
let aliceSpaceId: string;
let aliceColId: string;   // 링크 2개를 가진 alice의 컬렉션
let bobSpaceId: string;

beforeAll(async () => {
  alice = await makeUser(`share-alice-${Date.now()}@test.local`);
  bob = await makeUser(`share-bob-${Date.now()}@test.local`);

  const { data: s } = await alice.client.from("spaces")
    .insert({ user_id: alice.id, name: "Alice 스페이스" }).select().single();
  aliceSpaceId = s!.id;
  const { data: c } = await alice.client.from("collections")
    .insert({ user_id: alice.id, space_id: aliceSpaceId, title: "공유할 자료", icon: "📌" })
    .select().single();
  aliceColId = c!.id;
  await alice.client.from("links").insert([
    { user_id: alice.id, collection_id: aliceColId, url: "https://a.com", title: "A", position: 1000 },
    { user_id: alice.id, collection_id: aliceColId, url: "https://b.com", title: "B", position: 2000 },
  ]);

  const { data: bs } = await bob.client.from("spaces")
    .insert({ user_id: bob.id, name: "Bob 스페이스" }).select().single();
  bobSpaceId = bs!.id;
});

describe("create_collection_share_code RPC", () => {
  it("8자 코드(혼동 문자 제외)와 7일 만료를 발급한다", async () => {
    const { data, error } = await alice.client.rpc("create_collection_share_code", {
      p_collection_id: aliceColId,
    });
    expect(error).toBeNull();
    const row = data![0];
    expect(row.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    const days = (new Date(row.expires_at).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it("활성 코드가 있으면 새로 만들지 않고 같은 코드를 반환한다", async () => {
    const { data: first } = await alice.client.rpc("create_collection_share_code", { p_collection_id: aliceColId });
    const { data: second } = await alice.client.rpc("create_collection_share_code", { p_collection_id: aliceColId });
    expect(second![0].code).toBe(first![0].code);
  });

  it("발급자는 자기 코드를 조회하고 회수할 수 있다", async () => {
    const { data } = await alice.client.rpc("create_collection_share_code", { p_collection_id: aliceColId });
    const code = data![0].code;
    const { data: mine } = await alice.client.from("collection_share_codes").select().eq("code", code);
    expect(mine).toHaveLength(1);
    const { error } = await alice.client.from("collection_share_codes")
      .update({ revoked_at: new Date().toISOString() }).eq("code", code);
    expect(error).toBeNull();
    // 회수 후 재발급하면 새 코드가 나온다
    const { data: reissued } = await alice.client.rpc("create_collection_share_code", { p_collection_id: aliceColId });
    expect(reissued![0].code).not.toBe(code);
  });

  it("타인 코드는 테이블 조회로 보이지 않는다 (코드는 비밀값)", async () => {
    const { data } = await bob.client.from("collection_share_codes").select();
    expect(data).toHaveLength(0);
  });

  it("남의 컬렉션에는 코드를 발급할 수 없다", async () => {
    const { error } = await bob.client.rpc("create_collection_share_code", { p_collection_id: aliceColId });
    expect(error).not.toBeNull();
  });

  it("무기한(null) 발급이 가능하다", async () => {
    // 기존 활성 코드를 회수한 뒤 무기한으로 발급
    await alice.client.from("collection_share_codes")
      .update({ revoked_at: new Date().toISOString() }).eq("collection_id", aliceColId);
    const { data } = await alice.client.rpc("create_collection_share_code", {
      p_collection_id: aliceColId, p_expires_in_days: null,
    });
    expect(data![0].expires_at).toBeNull();
  });

  it("발급자라도 revoked_at 외의 컬럼은 바꿀 수 없다", async () => {
    const { data } = await alice.client.rpc("create_collection_share_code", { p_collection_id: aliceColId });
    const code = data![0].code;
    const { error } = await alice.client.from("collection_share_codes")
      .update({ collection_id: bobSpaceId }).eq("code", code);
    expect(error).not.toBeNull();
  });
});
