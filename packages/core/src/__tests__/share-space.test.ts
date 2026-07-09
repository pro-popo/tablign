import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";

const envText = readFileSync(resolve(__dirname, "../../.env.test"), "utf8");
const env = Object.fromEntries(
  envText.split("\n").filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);
const URL = env.SUPABASE_URL, ANON = env.SUPABASE_ANON_KEY, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

export const admin = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
});

async function makeUser(email: string): Promise<{ client: SupabaseClient; id: string; email: string }> {
  const { data: created, error } = await admin.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  if (error) throw error;
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: "password123" });
  if (signInErr) throw signInErr;
  return { client, id: created.user!.id, email };
}

// owner=스페이스 소유자, editor·viewer=멤버, outsider=비멤버
let owner: Awaited<ReturnType<typeof makeUser>>;
let editor: Awaited<ReturnType<typeof makeUser>>;
let viewer: Awaited<ReturnType<typeof makeUser>>;
let outsider: Awaited<ReturnType<typeof makeUser>>;
let spaceId: string;

beforeAll(async () => {
  const t = Date.now();
  owner = await makeUser(`ss-owner-${t}@test.local`);
  editor = await makeUser(`ss-editor-${t}@test.local`);
  viewer = await makeUser(`ss-viewer-${t}@test.local`);
  outsider = await makeUser(`ss-outsider-${t}@test.local`);

  const { data: s } = await owner.client.from("spaces").insert({ user_id: owner.id, name: "공유 스페이스" }).select().single();
  spaceId = s!.id;
  // 멤버십은 RLS/트리거를 우회해 admin으로 시드한다
  const { error: insertErr } = await admin.from("space_members").insert([
    { space_id: spaceId, user_id: editor.id, role: "editor" },
    { space_id: spaceId, user_id: viewer.id, role: "viewer" },
  ]);
  if (insertErr) {
    console.error("Failed to insert space_members:", insertErr);
    throw insertErr;
  }
});

describe("헬퍼 함수", () => {
  it("has_space_access: 오너·멤버는 true, 비멤버는 false", async () => {
    for (const u of [owner, editor, viewer]) {
      const { data } = await u.client.rpc("has_space_access", { p_space_id: spaceId });
      expect(data).toBe(true);
    }
    const { data: no } = await outsider.client.rpc("has_space_access", { p_space_id: spaceId });
    expect(no).toBe(false);
  });

  it("can_edit_space: 오너·editor는 true, viewer·비멤버는 false", async () => {
    expect((await owner.client.rpc("can_edit_space", { p_space_id: spaceId })).data).toBe(true);
    expect((await editor.client.rpc("can_edit_space", { p_space_id: spaceId })).data).toBe(true);
    expect((await viewer.client.rpc("can_edit_space", { p_space_id: spaceId })).data).toBe(false);
    expect((await outsider.client.rpc("can_edit_space", { p_space_id: spaceId })).data).toBe(false);
  });

  it("is_space_owner: 오너만 true", async () => {
    expect((await owner.client.rpc("is_space_owner", { p_space_id: spaceId })).data).toBe(true);
    expect((await editor.client.rpc("is_space_owner", { p_space_id: spaceId })).data).toBe(false);
  });
});

describe("space_members RLS·트리거", () => {
  it("멤버는 같은 스페이스 멤버 목록을 볼 수 있다", async () => {
    const { data } = await editor.client.from("space_members").select().eq("space_id", spaceId);
    expect(data!.length).toBe(2);
  });
  it("비멤버는 멤버 목록이 보이지 않는다", async () => {
    const { data } = await outsider.client.from("space_members").select().eq("space_id", spaceId);
    expect(data!.length).toBe(0);
  });
  it("멤버는 자기 role을 승격할 수 없다(트리거 차단)", async () => {
    const { error } = await viewer.client.from("space_members")
      .update({ role: "editor" }).eq("space_id", spaceId).eq("user_id", viewer.id);
    expect(error).not.toBeNull();
  });
  it("멤버는 자기 position은 바꿀 수 있다", async () => {
    const { error } = await viewer.client.from("space_members")
      .update({ position: 5000 }).eq("space_id", spaceId).eq("user_id", viewer.id);
    expect(error).toBeNull();
  });
  it("멤버는 직접 insert할 수 없다(정책 없음)", async () => {
    const { error } = await outsider.client.from("space_members")
      .insert({ space_id: spaceId, user_id: outsider.id, role: "viewer" });
    expect(error).not.toBeNull();
  });
  it("멤버는 스스로 나갈 수 있다(자기 행 delete)", async () => {
    // editor를 다시 시드한 뒤 자기 행 삭제
    await admin.from("space_members").upsert({ space_id: spaceId, user_id: editor.id, role: "editor" });
    const { error } = await editor.client.from("space_members").delete().eq("space_id", spaceId).eq("user_id", editor.id);
    expect(error).toBeNull();
    const { data } = await admin.from("space_members").select().eq("space_id", spaceId).eq("user_id", editor.id);
    expect(data!.length).toBe(0);
    await admin.from("space_members").insert({ space_id: spaceId, user_id: editor.id, role: "editor" }); // 후속 테스트 위해 복구
  });
});
