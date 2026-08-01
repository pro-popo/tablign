import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";
import { importBookmarks } from "../data/import";
import type { ImportPlan } from "../import/types";

const envText = readFileSync(resolve(__dirname, "../../.env.test"), "utf8");
const env = Object.fromEntries(
  envText.split("\n").filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);
const URL_ = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) throw new Error(".env.test 키 누락");

async function makeUser(email: string): Promise<{ client: SupabaseClient; id: string }> {
  const admin = createClient(URL_, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: "test-password-1234", email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(URL_, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email, password: "test-password-1234",
  });
  if (signInError) throw signInError;
  return { client, id: created.user!.id };
}

async function personalOrgId(user: { client: SupabaseClient }): Promise<string> {
  const { data } = await user.client.from("organizations").select("id").eq("is_personal", true).single();
  return (data as { id: string }).id;
}

function plan(spaces: ImportPlan["spaces"]): ImportPlan {
  let collections = 0, links = 0;
  for (const s of spaces) for (const c of s.collections) { collections++; links += c.links.length; }
  return { spaces, totals: { spaces: spaces.length, collections, links } };
}

const col = (title: string, urls: string[]) => ({
  sourceId: title, title, synthetic: false,
  links: urls.map((u) => ({ url: u, title: u, favicon_url: `${new URL(u).origin}/favicon.ico` })),
});

let alice: { client: SupabaseClient; id: string };
let bob: { client: SupabaseClient; id: string };
let aliceOrg: string;

beforeAll(async () => {
  alice = await makeUser(`imp-alice-${Date.now()}@test.local`);
  bob = await makeUser(`imp-bob-${Date.now()}@test.local`);
  aliceOrg = await personalOrgId(alice);
}, 60000);

describe("import_bookmarks RPC", () => {
  it("스페이스·컬렉션·링크를 만들고 요약을 반환한다", async () => {
    const result = await importBookmarks(alice.client, aliceOrg, plan([
      { sourceId: "dev", name: "개발", collections: [
        col("React", ["https://react.dev/a", "https://react.dev/b"]),
        col("공유 폴더", ["https://dev.local/x"]),
      ]},
      { sourceId: "news", name: "뉴스", collections: [col("공유 폴더", ["https://news.local/a"])] },
    ]));

    expect(result.space_ids).toHaveLength(2);
    expect(result.first_space_id).toBe(result.space_ids[0]);
    expect(result.links).toBe(4);

    const { data: spaces } = await alice.client
      .from("spaces").select("id,name,position").in("id", result.space_ids).order("position");
    expect((spaces as { name: string }[]).map((s) => s.name)).toEqual(["개발", "뉴스"]);

    const { data: cols } = await alice.client
      .from("collections").select("title,position,is_private").eq("space_id", result.space_ids[0]).order("position");
    expect((cols as { title: string }[]).map((c) => c.title)).toEqual(["React", "공유 폴더"]);
    expect((cols as { is_private: boolean }[])[0].is_private).toBe(false);
  }, 60000);

  it("링크의 url·title·favicon_url·position을 보존한다", async () => {
    const result = await importBookmarks(alice.client, aliceOrg, plan([
      { sourceId: "s", name: "보존확인", collections: [col("C", ["https://a.com/1", "https://a.com/2"])] },
    ]));
    const { data: cols } = await alice.client
      .from("collections").select("id").eq("space_id", result.space_ids[0]);
    const { data: links } = await alice.client
      .from("links").select("url,title,favicon_url,position")
      .eq("collection_id", (cols as { id: string }[])[0].id).order("position");
    const rows = links as { url: string; favicon_url: string; position: number }[];
    expect(rows.map((l) => l.url)).toEqual(["https://a.com/1", "https://a.com/2"]);
    expect(rows[0].favicon_url).toBe("https://a.com/favicon.ico");
    expect(rows.map((l) => l.position)).toEqual([1000, 2000]);
  }, 60000);

  it("스페이스 position은 조직 기존 최대값 뒤에 이어 붙는다", async () => {
    const { data: before } = await alice.client
      .from("spaces").select("position").eq("org_id", aliceOrg).order("position", { ascending: false }).limit(1);
    const maxBefore = (before as { position: number }[])[0]?.position ?? 0;

    const result = await importBookmarks(alice.client, aliceOrg, plan([
      { sourceId: "s", name: "뒤에붙음", collections: [col("C", ["https://tail.com/1"])] },
    ]));
    const { data } = await alice.client.from("spaces").select("position").eq("id", result.space_ids[0]).single();
    expect((data as { position: number }).position).toBeGreaterThan(maxBefore);
  }, 60000);

  it("남의 조직에는 가져올 수 없다", async () => {
    await expect(
      importBookmarks(bob.client, aliceOrg, plan([
        { sourceId: "s", name: "침입", collections: [col("C", ["https://evil.com/1"])] },
      ])),
    ).rejects.toThrow();

    const { data } = await alice.client.from("spaces").select("id").eq("org_id", aliceOrg).eq("name", "침입");
    expect(data).toHaveLength(0);
  }, 60000);

  it("빈 계획은 거부한다", async () => {
    await expect(importBookmarks(alice.client, aliceOrg, plan([]))).rejects.toThrow();
  }, 60000);

  it("중간에 실패하면 전부 롤백된다(반쪽짜리 보드가 남지 않는다)", async () => {
    // 두 번째 스페이스의 name이 null → not null 위반으로 트랜잭션 전체가 실패해야 한다
    const bad = plan([
      { sourceId: "ok", name: "롤백확인", collections: [col("C", ["https://rb.com/1"])] },
      { sourceId: "bad", name: null as unknown as string, collections: [] },
    ]);
    await expect(importBookmarks(alice.client, aliceOrg, bad)).rejects.toThrow();

    const { data } = await alice.client
      .from("spaces").select("id").eq("org_id", aliceOrg).eq("name", "롤백확인");
    expect(data).toHaveLength(0);
  }, 60000);

  it("컬렉션이 여러 개면 position이 순서대로 부여된다", async () => {
    const result = await importBookmarks(alice.client, aliceOrg, plan([
      { sourceId: "s", name: "순서확인", collections: [
        col("A", ["https://o.com/1"]), col("B", ["https://o.com/2"]), col("C", ["https://o.com/3"]),
      ]},
    ]));
    const { data } = await alice.client
      .from("collections").select("title,position").eq("space_id", result.space_ids[0]).order("position");
    expect(data).toEqual([
      { title: "A", position: 1000 }, { title: "B", position: 2000 }, { title: "C", position: 3000 },
    ]);
  }, 60000);
});
