import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";
import { createSpace } from "../data/spaces";
import { createCollection } from "../data/collections";
import { createLink } from "../data/links";
import { loadSpacesForExport } from "../data/export";
import { fromTobyExport, toTobyExport } from "../import/toby";

describe("toTobyExport", () => {
  const spaces = [
    {
      name: "개발",
      collections: [
        {
          title: "문서",
          links: [
            { url: "https://a.dev", title: "A", custom_title: null, favicon_url: "https://a.dev/f.png" },
            { url: "https://b.dev", title: "B 원래", custom_title: "B 고침", favicon_url: null },
          ],
        },
      ],
    },
    { name: "빈 스페이스", collections: [] },
  ];

  it("groups → lists → cards 구조로 만든다", () => {
    const out = toTobyExport(spaces);
    expect(out.groups[0].name).toBe("개발");
    expect(out.groups[0].lists[0].title).toBe("문서");
    expect(out.groups[0].lists[0].cards[0]).toMatchObject({ url: "https://a.dev", title: "A" });
  });

  it("fromTobyExport로 다시 읽으면 이름·제목·주소·파비콘이 그대로다", () => {
    const roots = fromTobyExport(JSON.parse(JSON.stringify(toTobyExport(spaces))));
    const group = roots[0].children![0];
    expect(group.title).toBe("개발");
    const list = group.children![0];
    expect(list.title).toBe("문서");
    expect(list.children!.map((c) => [c.url, c.title, c.favicon])).toEqual([
      ["https://a.dev", "A", "https://a.dev/f.png"],
      ["https://b.dev", "B 고침", undefined],
    ]);
  });
});

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

describe("loadSpacesForExport", () => {
  let user: { client: SupabaseClient; id: string };

  beforeAll(async () => {
    user = await makeUser(`export-${Date.now()}@test.local`);
  });

  it("고른 순서대로 스페이스를 묶고, 컬렉션·링크는 position 순이다", async () => {
    const a = await createSpace(user.client, { user_id: user.id, name: "A" });
    const b = await createSpace(user.client, { user_id: user.id, name: "B" });
    const c2 = await createCollection(user.client, { user_id: user.id, space_id: a.id, title: "둘째", position: 2000 });
    const c1 = await createCollection(user.client, { user_id: user.id, space_id: a.id, title: "첫째", position: 1000 });
    await createLink(user.client, { user_id: user.id, collection_id: c1.id, url: "https://2.dev", position: 2000 });
    await createLink(user.client, { user_id: user.id, collection_id: c1.id, url: "https://1.dev", title: "하나", position: 1000 });
    await createLink(user.client, { user_id: user.id, collection_id: c2.id, url: "https://3.dev" });

    const out = await loadSpacesForExport(user.client, [b, a]);

    expect(out.map((s) => s.name)).toEqual(["B", "A"]);
    expect(out[0].collections).toEqual([]);
    expect(out[1].collections.map((c) => c.title)).toEqual(["첫째", "둘째"]);
    expect(out[1].collections[0].links.map((l) => l.url)).toEqual(["https://1.dev", "https://2.dev"]);
    expect(out[1].collections[0].links[0]).toMatchObject({ title: "하나", custom_title: null, favicon_url: null });
  });
});
