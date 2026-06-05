import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listSpaces, createSpace, updateSpace, deleteSpace } from "../data/spaces";

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
if (!URL || !ANON || !SERVICE) throw new Error(".env.test 키 누락");

async function makeUser(email: string): Promise<{ client: SupabaseClient; id: string }> {
  const admin = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: "password123",
    email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: "password123",
  });
  if (signInErr) throw signInErr;
  return { client, id: created.user!.id };
}

describe("spaces 데이터 접근", () => {
  let user: { client: SupabaseClient; id: string };

  beforeAll(async () => {
    user = await makeUser(`spaces-${Date.now()}@test.local`);
  });

  it("스페이스를 만들고 목록에 나타난다", async () => {
    const created = await createSpace(user.client, { user_id: user.id, name: "개인" });
    expect(created.name).toBe("개인");
    const list = await listSpaces(user.client);
    expect(list.some((s) => s.id === created.id)).toBe(true);
  });

  it("스페이스 이름을 수정한다", async () => {
    const created = await createSpace(user.client, { user_id: user.id, name: "임시" });
    const updated = await updateSpace(user.client, created.id, { name: "수정됨" });
    expect(updated.name).toBe("수정됨");
  });

  it("스페이스를 삭제한다", async () => {
    const created = await createSpace(user.client, { user_id: user.id, name: "삭제대상" });
    await deleteSpace(user.client, created.id);
    const list = await listSpaces(user.client);
    expect(list.some((s) => s.id === created.id)).toBe(false);
  });

  it("목록은 position 오름차순으로 정렬된다", async () => {
    const u = await makeUser(`spaces-order-${Date.now()}@test.local`);
    await createSpace(u.client, { user_id: u.id, name: "A", position: 3000 });
    await createSpace(u.client, { user_id: u.id, name: "B", position: 1000 });
    const list = await listSpaces(u.client);
    const positions = list.map((s) => s.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
