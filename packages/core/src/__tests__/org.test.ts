import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";
import { listOrganizations, createOrganization, updateOrganization, listMyOrgMemberships } from "../data/organizations";
import { listOrgMembers, updateOrgMemberRole } from "../data/org-members";
import { inviteToOrg, listOrgInvitations, listMyOrgInvitations, acceptOrgInvitation, cancelOrgInvitation } from "../data/org-invitations";

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

describe("spaces.org_id 백필·트리거", () => {
  it("신규 가입 유저는 개인 조직을 자동으로 갖는다", async () => {
    const { data } = await admin.from("organizations").select().eq("owner_id", owner.id).eq("is_personal", true);
    expect(data!.length).toBe(1);
    expect(data![0].name).toBe("개인");
  });
  it("org_id 없이 만든 스페이스는 개인 조직으로 자동 소속된다", async () => {
    const { data: s, error } = await owner.client.from("spaces").insert({ user_id: owner.id, name: "자동 org" }).select().single();
    expect(error).toBeNull();
    const { data: personal } = await admin.from("organizations").select("id").eq("owner_id", owner.id).eq("is_personal", true).single();
    expect(s!.org_id).toBe(personal!.id);
  });
  it("org_id를 명시하면 그 조직에 소속된다", async () => {
    const { data: s, error } = await owner.client.from("spaces").insert({ user_id: owner.id, name: "팀 스페이스", org_id: orgId }).select().single();
    expect(error).toBeNull();
    expect(s!.org_id).toBe(orgId);
  });
});

describe("조직 스페이스 접근 매트릭스", () => {
  let teamSpaceId: string;
  let colId: string;
  beforeAll(async () => {
    await admin.from("organization_members").upsert([
      { org_id: orgId, user_id: adminMember.id, role: "admin" },
      { org_id: orgId, user_id: member.id, role: "member" },
    ]);
    const { data: s } = await owner.client.from("spaces").insert({ user_id: owner.id, name: "조직 스페이스", org_id: orgId }).select().single();
    teamSpaceId = s!.id;
    const { data: c } = await owner.client.from("collections").insert({ user_id: owner.id, space_id: teamSpaceId, title: "조직 컬렉션" }).select().single();
    colId = c!.id;
  });
  it("조직 멤버는 조직 스페이스·컬렉션을 본다", async () => {
    for (const u of [adminMember, member]) {
      expect((await u.client.from("spaces").select().eq("id", teamSpaceId)).data!.length).toBe(1);
      expect((await u.client.from("collections").select().eq("id", colId)).data!.length).toBe(1);
    }
  });
  it("비멤버는 조직 스페이스가 안 보인다", async () => {
    expect((await outsider.client.from("spaces").select().eq("id", teamSpaceId)).data!.length).toBe(0);
  });
  it("admin은 조직 스페이스에 컬렉션을 만들 수 있다", async () => {
    const { error } = await adminMember.client.from("collections").insert({ user_id: adminMember.id, space_id: teamSpaceId, title: "admin 컬렉션" });
    expect(error).toBeNull();
  });
  it("member는 조직 스페이스에 컬렉션을 못 만든다(읽기 전용)", async () => {
    const { error } = await member.client.from("collections").insert({ user_id: member.id, space_id: teamSpaceId, title: "member 시도" });
    expect(error).not.toBeNull();
  });
  it("member는 조직 스페이스를 만들 수 없다(생성은 owner/admin)", async () => {
    const { error } = await member.client.from("spaces").insert({ user_id: member.id, name: "member 스페이스", org_id: orgId });
    expect(error).not.toBeNull();
  });
});

describe("organizations 소유권 가드", () => {
  it("admin은 owner_id를 바꿀 수 없다(트리거 차단)", async () => {
    const { error } = await adminMember.client.from("organizations")
      .update({ owner_id: adminMember.id }).eq("id", orgId);
    expect(error).not.toBeNull();
    expect((await admin.from("organizations").select("owner_id").eq("id", orgId).single()).data!.owner_id).toBe(owner.id);
  });
  it("owner도 is_personal을 바꿀 수 없다(트리거 차단)", async () => {
    const { error } = await owner.client.from("organizations")
      .update({ is_personal: true }).eq("id", orgId);
    expect(error).not.toBeNull();
    expect((await admin.from("organizations").select("is_personal").eq("id", orgId).single()).data!.is_personal).toBe(false);
  });
  it("admin은 여전히 name을 바꿀 수 있다(가드가 과차단하지 않는다)", async () => {
    const { error } = await adminMember.client.from("organizations").update({ name: "가드 확인용" }).eq("id", orgId);
    expect(error).toBeNull();
    expect((await admin.from("organizations").select("name").eq("id", orgId).single()).data!.name).toBe("가드 확인용");
    await adminMember.client.from("organizations").update({ name: "팀 조직" }).eq("id", orgId); // 복구
  });
});

describe("조직 데이터 계층", () => {
  it("listOrganizations는 내 개인 조직과 팀 조직을 돌려준다", async () => {
    const orgs = await listOrganizations(owner.client);
    expect(orgs.some((o) => o.id === orgId)).toBe(true);
    expect(orgs.some((o) => o.is_personal)).toBe(true);
  });
  it("createOrganization으로 팀 조직을 만들 수 있다(is_personal=false)", async () => {
    const org = await createOrganization(owner.client, { name: "새 팀", owner_id: owner.id });
    expect(org.name).toBe("새 팀");
    expect(org.is_personal).toBe(false);
    await owner.client.from("organizations").delete().eq("id", org.id);
  });
  it("listMyOrgMemberships는 내 멤버십을 돌려준다", async () => {
    const ms = await listMyOrgMemberships(member.client);
    expect(ms.some((m) => m.org_id === orgId && m.role === "member")).toBe(true);
  });
  it("updateOrganization으로 admin이 이름을 바꾼다", async () => {
    const updated = await updateOrganization(adminMember.client, orgId, { name: "이름 변경" });
    expect(updated.name).toBe("이름 변경");
    await updateOrganization(adminMember.client, orgId, { name: "팀 조직" });
  });
});

describe("조직 초대 RPC", () => {
  it("owner는 이메일로 초대할 수 있고 이메일은 소문자 정규화된다", async () => {
    const { data, error } = await owner.client.rpc("invite_to_org", { p_org_id: orgId, p_email: outsider.email.toUpperCase(), p_role: "member" });
    expect(error).toBeNull();
    const { data: inv } = await admin.from("organization_invitations").select().eq("id", data);
    expect(inv![0].invitee_email).toBe(outsider.email.toLowerCase());
  });
  it("admin도 초대할 수 있다", async () => {
    const { error } = await adminMember.client.rpc("invite_to_org", { p_org_id: orgId, p_email: "x-admininvite@test.local", p_role: "member" });
    expect(error).toBeNull();
    await admin.from("organization_invitations").delete().eq("org_id", orgId).eq("invitee_email", "x-admininvite@test.local");
  });
  it("member는 초대할 수 없다", async () => {
    const { error } = await member.client.rpc("invite_to_org", { p_org_id: orgId, p_email: "y@test.local", p_role: "member" });
    expect(error).not.toBeNull();
  });
  it("이미 멤버인 사람은 초대할 수 없다", async () => {
    const { error } = await owner.client.rpc("invite_to_org", { p_org_id: orgId, p_email: member.email, p_role: "member" });
    expect(error).not.toBeNull();
  });
  it("초대받은 사람은 목록에서 보고 수락하면 멤버가 된다", async () => {
    const seen = await outsider.client.rpc("get_my_org_invitations");
    const inv = (seen.data as { id: string; org_id: string }[]).find((i) => i.org_id === orgId);
    expect(inv).toBeTruthy();
    const { error } = await outsider.client.rpc("accept_org_invitation", { p_invitation_id: inv!.id });
    expect(error).toBeNull();
    const { data: mem } = await admin.from("organization_members").select().eq("org_id", orgId).eq("user_id", outsider.id);
    expect(mem![0].role).toBe("member");
    await admin.from("organization_members").delete().eq("org_id", orgId).eq("user_id", outsider.id);
    await admin.from("organization_invitations").delete().eq("org_id", orgId).eq("invitee_email", outsider.email.toLowerCase());
  });
  it("남의 이메일 초대는 수락할 수 없다", async () => {
    const { data: id } = await owner.client.rpc("invite_to_org", { p_org_id: orgId, p_email: "someone-else@test.local", p_role: "member" });
    const { error } = await outsider.client.rpc("accept_org_invitation", { p_invitation_id: id });
    expect(error).not.toBeNull();
    await admin.from("organization_invitations").delete().eq("id", id);
  });
});

describe("organization_members RLS: admin 멤버 관리 권한", () => {
  beforeAll(async () => {
    // adminMember=admin, member=member 상태로 정렬 (이전 describe에서 흐트러졌을 수 있음)
    await admin.from("organization_members").upsert([
      { org_id: orgId, user_id: adminMember.id, role: "admin" },
      { org_id: orgId, user_id: member.id, role: "member" },
    ]);
  });

  it("admin은 멤버를 제거할 수 있다", async () => {
    await admin.from("organization_members").upsert({ org_id: orgId, user_id: outsider.id, role: "member" });
    const { error } = await adminMember.client.from("organization_members")
      .delete().eq("org_id", orgId).eq("user_id", outsider.id);
    expect(error).toBeNull();
    const { data } = await admin.from("organization_members").select().eq("org_id", orgId).eq("user_id", outsider.id);
    expect(data!.length).toBe(0);
  });

  it("admin은 멤버의 role을 바꿀 수 있다", async () => {
    const { error } = await adminMember.client.from("organization_members")
      .update({ role: "admin" }).eq("org_id", orgId).eq("user_id", member.id);
    expect(error).toBeNull();
    const { data } = await admin.from("organization_members").select("role").eq("org_id", orgId).eq("user_id", member.id).single();
    expect(data!.role).toBe("admin");
    // 복구: service_role은 auth.uid()가 없어 can_edit_org가 false이므로 가드 트리거에 막힌다.
    // 실제 권한을 가진 adminMember 클라이언트로 복구해야 한다.
    await adminMember.client.from("organization_members").update({ role: "member" }).eq("org_id", orgId).eq("user_id", member.id);
  });

  it("member는 다른 사람의 role을 바꿀 수 없다(영향 없음)", async () => {
    // adminMember는 현재 admin -> member로 강등 시도(원래는 admin이므로 값이 바뀌면 감지 가능)
    await member.client.from("organization_members")
      .update({ role: "member" }).eq("org_id", orgId).eq("user_id", adminMember.id);
    const { data } = await admin.from("organization_members").select("role").eq("org_id", orgId).eq("user_id", adminMember.id).single();
    expect(data!.role).toBe("admin"); // 바뀌지 않아야 함
  });

  it("member는 자기 role을 셀프 승격할 수 없다(트리거 차단)", async () => {
    const { error } = await member.client.from("organization_members")
      .update({ role: "admin" }).eq("org_id", orgId).eq("user_id", member.id);
    expect(error).not.toBeNull();
    const { data } = await admin.from("organization_members").select("role").eq("org_id", orgId).eq("user_id", member.id).single();
    expect(data!.role).toBe("member");
  });

  it("member는 여전히 자기 position을 바꿀 수 있고, 탈퇴(자기 행 삭제)할 수 있다", async () => {
    const { error: posErr } = await member.client.from("organization_members")
      .update({ position: 2000 }).eq("org_id", orgId).eq("user_id", member.id);
    expect(posErr).toBeNull();
    const { data: posData } = await admin.from("organization_members").select("position").eq("org_id", orgId).eq("user_id", member.id).single();
    expect(posData!.position).toBe(2000);

    const { error: delErr } = await member.client.from("organization_members")
      .delete().eq("org_id", orgId).eq("user_id", member.id);
    expect(delErr).toBeNull();
    const { data: afterDelete } = await admin.from("organization_members").select().eq("org_id", orgId).eq("user_id", member.id);
    expect(afterDelete!.length).toBe(0);

    // 다른 describe 블록에 영향 없도록 재시딩
    await admin.from("organization_members").upsert({ org_id: orgId, user_id: member.id, role: "member", position: 1000 });
  });
});

describe("조직 멤버·초대 데이터 계층", () => {
  it("listOrgMembers는 프로필과 함께 멤버를 돌려준다", async () => {
    await admin.from("organization_members").upsert([
      { org_id: orgId, user_id: adminMember.id, role: "admin" },
      { org_id: orgId, user_id: member.id, role: "member" },
    ]);
    const members = await listOrgMembers(owner.client, orgId);
    expect(members.length).toBeGreaterThanOrEqual(2);
    expect(members[0]).toHaveProperty("display_name");
    expect(members[0]).toHaveProperty("role");
  });
  it("owner는 멤버 role을 바꿀 수 있다", async () => {
    await updateOrgMemberRole(owner.client, orgId, member.id, "admin");
    const { data } = await admin.from("organization_members").select("role").eq("org_id", orgId).eq("user_id", member.id).single();
    expect(data!.role).toBe("admin");
    await updateOrgMemberRole(owner.client, orgId, member.id, "member");
  });
  it("초대 → 내 초대 목록 → 수락 전체 흐름", async () => {
    const id = await inviteToOrg(owner.client, orgId, outsider.email, "member");
    const mine = await listMyOrgInvitations(outsider.client);
    expect(mine.some((i) => i.id === id)).toBe(true);
    expect(mine.find((i) => i.id === id)!.org_name).toBe("팀 조직");
    await acceptOrgInvitation(outsider.client, id);
    const { data } = await admin.from("organization_members").select().eq("org_id", orgId).eq("user_id", outsider.id);
    expect(data!.length).toBe(1);
    await admin.from("organization_members").delete().eq("org_id", orgId).eq("user_id", outsider.id);
  });
  it("owner는 대기 중 초대를 취소할 수 있다", async () => {
    const id = await inviteToOrg(owner.client, orgId, "cancel-me@test.local", "member");
    await cancelOrgInvitation(owner.client, id);
    const list = await listOrgInvitations(owner.client, orgId);
    expect(list.some((i) => i.id === id)).toBe(false);
  });
});
