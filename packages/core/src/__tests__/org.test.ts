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
async function makeUser(email: string) {
  const { data: created, error } = await admin.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  if (error) throw error;
  const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: ws as unknown as typeof WebSocket } });
  const { error: e } = await client.auth.signInWithPassword({ email, password: "password123" });
  if (e) throw e;
  return { client, id: created.user!.id, email };
}

let owner: Awaited<ReturnType<typeof makeUser>>;
let adminMember: Awaited<ReturnType<typeof makeUser>>;
let member: Awaited<ReturnType<typeof makeUser>>;
let outsider: Awaited<ReturnType<typeof makeUser>>;
let orgId: string;

beforeAll(async () => {
  const t = Date.now();
  owner = await makeUser(`org-owner-${t}@test.local`);
  adminMember = await makeUser(`org-admin-${t}@test.local`);
  member = await makeUser(`org-member-${t}@test.local`);
  outsider = await makeUser(`org-out-${t}@test.local`);
  const { data: o, error } = await owner.client.from("organizations")
    .insert({ name: "팀 조직", owner_id: owner.id }).select().single();
  if (error) throw error;
  orgId = o!.id;
  const { error: mErr } = await admin.from("organization_members").insert([
    { org_id: orgId, user_id: adminMember.id, role: "admin" },
    { org_id: orgId, user_id: member.id, role: "member" },
  ]);
  if (mErr) throw mErr;
});

describe("조직 헬퍼", () => {
  it("has_org_access: 오너·멤버 true, 비멤버 false", async () => {
    for (const u of [owner, adminMember, member]) {
      expect((await u.client.rpc("has_org_access", { p_org_id: orgId })).data).toBe(true);
    }
    expect((await outsider.client.rpc("has_org_access", { p_org_id: orgId })).data).toBe(false);
  });
  it("can_edit_org: 오너·admin true, member·비멤버 false", async () => {
    expect((await owner.client.rpc("can_edit_org", { p_org_id: orgId })).data).toBe(true);
    expect((await adminMember.client.rpc("can_edit_org", { p_org_id: orgId })).data).toBe(true);
    expect((await member.client.rpc("can_edit_org", { p_org_id: orgId })).data).toBe(false);
    expect((await outsider.client.rpc("can_edit_org", { p_org_id: orgId })).data).toBe(false);
  });
});

describe("organizations RLS", () => {
  it("멤버는 조직을 보고, 비멤버는 못 본다", async () => {
    expect((await member.client.from("organizations").select().eq("id", orgId)).data!.length).toBe(1);
    expect((await outsider.client.from("organizations").select().eq("id", orgId)).data!.length).toBe(0);
  });
  it("member는 조직 이름을 못 바꾸고, admin은 바꾼다", async () => {
    await member.client.from("organizations").update({ name: "탈취" }).eq("id", orgId);
    expect((await admin.from("organizations").select("name").eq("id", orgId).single()).data!.name).toBe("팀 조직");
    const { error } = await adminMember.client.from("organizations").update({ name: "새 이름" }).eq("id", orgId);
    expect(error).toBeNull();
    await adminMember.client.from("organizations").update({ name: "팀 조직" }).eq("id", orgId); // 복구
  });
  it("오너만 조직을 삭제할 수 있다", async () => {
    await member.client.from("organizations").delete().eq("id", orgId);
    expect((await admin.from("organizations").select().eq("id", orgId)).data!.length).toBe(1);
  });
  it("멤버는 자기 role을 승격할 수 없다(트리거 차단)", async () => {
    const { error } = await member.client.from("organization_members")
      .update({ role: "admin" }).eq("org_id", orgId).eq("user_id", member.id);
    expect(error).not.toBeNull();
  });
});
