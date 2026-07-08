import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";
import {
  createCollectionShareCode, revokeCollectionShareCode, getShareCodeInfo, importCollectionByCode,
} from "../data/share";

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

describe("get_share_code_info / import_collection_by_code RPC", () => {
  let activeCode: string;

  beforeAll(async () => {
    // 이전 테스트가 회수했을 수 있으므로 새 활성 코드를 확보
    const { data } = await alice.client.rpc("create_collection_share_code", { p_collection_id: aliceColId });
    activeCode = data![0].code;
  });

  it("발급자가 아니어도 코드로 미리보기 정보를 얻는다", async () => {
    const { data, error } = await bob.client.rpc("get_share_code_info", { p_code: activeCode });
    expect(error).toBeNull();
    const info = data![0];
    expect(info.title).toBe("공유할 자료");
    expect(info.icon).toBe("📌");
    expect(Number(info.link_count)).toBe(2);
    expect(typeof info.shared_by === "string" || info.shared_by === null).toBe(true);
  });

  it("존재하지 않는 코드는 에러", async () => {
    const { error } = await bob.client.rpc("get_share_code_info", { p_code: "XXXXXXXX" });
    expect(error).not.toBeNull();
  });

  it("코드로 자기 스페이스에 컬렉션을 가져온다 (링크 포함, 소유자는 가져간 사람)", async () => {
    const { data: newId, error } = await bob.client.rpc("import_collection_by_code", {
      p_code: activeCode, p_target_space_id: bobSpaceId,
    });
    expect(error).toBeNull();
    const { data: copied } = await bob.client.from("collections").select().eq("id", newId).single();
    expect(copied!.title).toBe("공유할 자료");
    expect(copied!.space_id).toBe(bobSpaceId);
    expect(copied!.user_id).toBe(bob.id);
    const { data: links } = await bob.client.from("links")
      .select().eq("collection_id", newId).order("position");
    expect(links!.map((l) => l.url)).toEqual(["https://a.com", "https://b.com"]);
    // 원본은 그대로
    const { data: original } = await alice.client.from("links").select().eq("collection_id", aliceColId);
    expect(original).toHaveLength(2);
  });

  it("남의 스페이스로는 가져올 수 없다", async () => {
    const { error } = await bob.client.rpc("import_collection_by_code", {
      p_code: activeCode, p_target_space_id: aliceSpaceId,
    });
    expect(error).not.toBeNull();
  });

  it("회수된 코드는 조회·가져오기 모두 에러", async () => {
    await alice.client.from("collection_share_codes")
      .update({ revoked_at: new Date().toISOString() }).eq("code", activeCode);
    const { error: infoErr } = await bob.client.rpc("get_share_code_info", { p_code: activeCode });
    expect(infoErr).not.toBeNull();
    const { error: impErr } = await bob.client.rpc("import_collection_by_code", {
      p_code: activeCode, p_target_space_id: bobSpaceId,
    });
    expect(impErr).not.toBeNull();
  });

  it("만료된 코드는 가져올 수 없다", async () => {
    // p_expires_in_days = 0 → 발급 즉시 만료
    const { data } = await alice.client.rpc("create_collection_share_code", {
      p_collection_id: aliceColId, p_expires_in_days: 0,
    });
    const expired = data![0].code;
    const { error } = await bob.client.rpc("import_collection_by_code", {
      p_code: expired, p_target_space_id: bobSpaceId,
    });
    expect(error).not.toBeNull();
  });

  it("발급자 본인도 코드로 가져올 수 있다 (내 스페이스 간 복사와 동일 효과)", async () => {
    // 만료 코드 정리 후 새 활성 코드 발급
    await alice.client.from("collection_share_codes")
      .update({ revoked_at: new Date().toISOString() }).eq("collection_id", aliceColId);
    const { data } = await alice.client.rpc("create_collection_share_code", { p_collection_id: aliceColId });
    const { data: newId, error } = await alice.client.rpc("import_collection_by_code", {
      p_code: data![0].code, p_target_space_id: aliceSpaceId,
    });
    expect(error).toBeNull();
    expect(newId).not.toBe(aliceColId);
  });
});

describe("share 데이터 함수 (core)", () => {
  it("발급 → 조회 → 가져오기 → 회수 전체 흐름", async () => {
    // 남아 있을 수 있는 활성 코드 정리
    await alice.client.from("collection_share_codes")
      .update({ revoked_at: new Date().toISOString() }).eq("collection_id", aliceColId);

    const issued = await createCollectionShareCode(alice.client, aliceColId);
    expect(issued.code).toHaveLength(8);
    expect(issued.expires_at).not.toBeNull();

    const info = await getShareCodeInfo(bob.client, issued.code);
    expect(info.title).toBe("공유할 자료");
    expect(info.link_count).toBe(2);

    const newId = await importCollectionByCode(bob.client, issued.code, bobSpaceId);
    expect(typeof newId).toBe("string");

    await revokeCollectionShareCode(alice.client, issued.code);
    await expect(getShareCodeInfo(bob.client, issued.code)).rejects.toBeTruthy();
  });

  it("무기한 발급 시 expires_at이 null이다", async () => {
    await alice.client.from("collection_share_codes")
      .update({ revoked_at: new Date().toISOString() }).eq("collection_id", aliceColId);
    const issued = await createCollectionShareCode(alice.client, aliceColId, null);
    expect(issued.expires_at).toBeNull();
  });
});
