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
    realtime: { transport: ws },
  });
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: "password123",
    email_confirm: true,
  });
  if (createErr) throw createErr;

  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: "password123",
  });
  if (signInErr) throw signInErr;

  return { client, id: created.user!.id };
}

describe("RLS 정책", () => {
  let alice: { client: SupabaseClient; id: string };
  let bob: { client: SupabaseClient; id: string };
  let aliceSpaceId: string;

  beforeAll(async () => {
    // 고유 이메일로 충돌 방지
    alice = await makeUser(`alice-${Date.now()}@test.local`);
    bob = await makeUser(`bob-${Date.now()}@test.local`);

    const { data, error } = await alice.client
      .from("spaces")
      .insert({ user_id: alice.id, name: "Alice 개인" })
      .select()
      .single();
    if (error) throw error;
    aliceSpaceId = data.id;
  });

  it("본인이 만든 space를 읽을 수 있다", async () => {
    const { data, error } = await alice.client.from("spaces").select();
    expect(error).toBeNull();
    expect(data!.some((s) => s.id === aliceSpaceId)).toBe(true);
  });

  it("타인의 space는 보이지 않는다", async () => {
    const { data, error } = await bob.client.from("spaces").select();
    expect(error).toBeNull();
    expect(data!.some((s) => s.id === aliceSpaceId)).toBe(false);
  });

  it("타인의 user_id로 space를 만들 수 없다(WITH CHECK 위반)", async () => {
    const { error } = await bob.client
      .from("spaces")
      .insert({ user_id: alice.id, name: "탈취 시도" });
    expect(error).not.toBeNull();
  });
});
