import { beforeAll, describe, expect, it } from "vitest";
import {
  listMembers, removeMember, updateMemberRole, updateMemberPosition, leaveSpace, listMyMemberships,
} from "../data/members";
import {
  inviteToSpace, listSpaceInvitations, listMyInvitations, acceptInvitation, declineInvitation, cancelInvitation,
} from "../data/invitations";
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

describe("헬퍼 함수 — 컬렉션·공유 판정", () => {
  let colId: string;
  beforeAll(async () => {
    await admin.from("space_members").upsert([
      { space_id: spaceId, user_id: editor.id, role: "editor" },
      { space_id: spaceId, user_id: viewer.id, role: "viewer" },
    ]);
    const { data: c } = await owner.client.from("collections")
      .insert({ user_id: owner.id, space_id: spaceId, title: "헬퍼 테스트 컬렉션" }).select().single();
    colId = c!.id;
  });
  it("has_collection_access: 멤버는 true, 비멤버는 false", async () => {
    expect((await editor.client.rpc("has_collection_access", { p_collection_id: colId })).data).toBe(true);
    expect((await viewer.client.rpc("has_collection_access", { p_collection_id: colId })).data).toBe(true);
    expect((await outsider.client.rpc("has_collection_access", { p_collection_id: colId })).data).toBe(false);
  });
  it("can_edit_collection: editor는 true, viewer·비멤버는 false", async () => {
    expect((await editor.client.rpc("can_edit_collection", { p_collection_id: colId })).data).toBe(true);
    expect((await viewer.client.rpc("can_edit_collection", { p_collection_id: colId })).data).toBe(false);
    expect((await outsider.client.rpc("can_edit_collection", { p_collection_id: colId })).data).toBe(false);
  });
  it("shares_space_with: 같은 스페이스 멤버끼리 true, 비멤버는 false", async () => {
    expect((await editor.client.rpc("shares_space_with", { p_other: owner.id })).data).toBe(true);
    expect((await owner.client.rpc("shares_space_with", { p_other: viewer.id })).data).toBe(true);
    expect((await outsider.client.rpc("shares_space_with", { p_other: owner.id })).data).toBe(false);
  });
});

describe("space_invitations RLS", () => {
  let invId: string;
  beforeAll(async () => {
    // 초대 insert 정책이 없으므로 admin으로 시드 (invitee=outsider)
    const { data } = await admin.from("space_invitations")
      .insert({ space_id: spaceId, inviter_id: owner.id, invitee_email: outsider.email, role: "viewer" })
      .select().single();
    invId = data!.id;
  });
  it("오너와 초대받은 본인은 초대를 볼 수 있다", async () => {
    expect((await owner.client.from("space_invitations").select().eq("id", invId)).data!.length).toBe(1);
    expect((await outsider.client.from("space_invitations").select().eq("id", invId)).data!.length).toBe(1);
  });
  it("무관한 사용자는 초대가 보이지 않는다", async () => {
    expect((await editor.client.from("space_invitations").select().eq("id", invId)).data!.length).toBe(0);
  });
  it("오너는 초대를 삭제할 수 있고, 초대받은 사람은 삭제할 수 없다", async () => {
    const { error: e1 } = await outsider.client.from("space_invitations").delete().eq("id", invId);
    // 초대받은 사람은 delete 정책이 없어 0행(에러는 아님) — 여전히 존재해야 한다
    expect((await admin.from("space_invitations").select().eq("id", invId)).data!.length).toBe(1);
    const { error: e2 } = await owner.client.from("space_invitations").delete().eq("id", invId);
    expect(e2).toBeNull();
    expect((await admin.from("space_invitations").select().eq("id", invId)).data!.length).toBe(0);
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

describe("공유 스페이스 접근 매트릭스", () => {
  let colId: string;
  let linkId: string;

  beforeAll(async () => {
    await admin.from("space_members").upsert([
      { space_id: spaceId, user_id: editor.id, role: "editor" },
      { space_id: spaceId, user_id: viewer.id, role: "viewer" },
    ]);
    const { data: c } = await owner.client.from("collections")
      .insert({ user_id: owner.id, space_id: spaceId, title: "공유 컬렉션" }).select().single();
    colId = c!.id;
    const { data: l } = await owner.client.from("links")
      .insert({ user_id: owner.id, collection_id: colId, url: "https://a.com", title: "A", position: 1000 }).select().single();
    linkId = l!.id;
  });

  it("editor·viewer는 공유 스페이스와 그 컬렉션·링크를 볼 수 있다", async () => {
    for (const u of [editor, viewer]) {
      expect((await u.client.from("spaces").select().eq("id", spaceId)).data!.length).toBe(1);
      expect((await u.client.from("collections").select().eq("id", colId)).data!.length).toBe(1);
      expect((await u.client.from("links").select().eq("id", linkId)).data!.length).toBe(1);
    }
  });

  it("비멤버는 공유 스페이스·컬렉션·링크가 보이지 않는다", async () => {
    expect((await outsider.client.from("spaces").select().eq("id", spaceId)).data!.length).toBe(0);
    expect((await outsider.client.from("collections").select().eq("id", colId)).data!.length).toBe(0);
    expect((await outsider.client.from("links").select().eq("id", linkId)).data!.length).toBe(0);
  });

  it("editor는 컬렉션·링크를 생성·수정할 수 있다", async () => {
    const { data: c, error } = await editor.client.from("collections")
      .insert({ user_id: editor.id, space_id: spaceId, title: "editor 컬렉션" }).select().single();
    expect(error).toBeNull();
    const { error: upErr } = await editor.client.from("collections").update({ title: "수정됨" }).eq("id", colId);
    expect(upErr).toBeNull(); // 다른 멤버가 만든 컬렉션도 편집 가능(협업)
    await editor.client.from("collections").delete().eq("id", c!.id);
  });

  it("viewer는 컬렉션·링크를 생성·수정할 수 없다", async () => {
    const { error: insErr } = await viewer.client.from("collections")
      .insert({ user_id: viewer.id, space_id: spaceId, title: "viewer 시도" });
    expect(insErr).not.toBeNull();
    const { error: upErr } = await viewer.client.from("links").update({ title: "viewer 시도" }).eq("id", linkId);
    expect(upErr).not.toBeNull();
  });

  it("viewer는 컬렉션·링크를 삭제할 수 없다", async () => {
    // delete 정책은 can_edit 게이트 — viewer는 매칭 0행(에러 아님), 행이 그대로 남아야 한다
    await viewer.client.from("links").delete().eq("id", linkId);
    expect((await admin.from("links").select().eq("id", linkId)).data!.length).toBe(1);
    await viewer.client.from("collections").delete().eq("id", colId);
    expect((await admin.from("collections").select().eq("id", colId)).data!.length).toBe(1);
  });

  it("editor라도 스페이스 이름은 못 바꾼다(오너만)", async () => {
    const { error } = await editor.client.from("spaces").update({ name: "탈취" }).eq("id", spaceId);
    // RLS update 정책이 오너 전용이라 매칭 행이 없어 조용히 0행 — 이름이 안 바뀌었는지로 검증
    const { data } = await admin.from("spaces").select("name").eq("id", spaceId).single();
    expect(data!.name).toBe("공유 스페이스");
  });

  it("멤버끼리 서로의 프로필(display_name)을 볼 수 있다", async () => {
    const { data } = await editor.client.from("profiles").select().eq("id", owner.id);
    expect(data!.length).toBe(1);
  });

  it("비멤버는 남의 프로필이 보이지 않는다", async () => {
    const { data } = await outsider.client.from("profiles").select().eq("id", owner.id);
    expect(data!.length).toBe(0);
  });
});

describe("초대 RPC", () => {
  it("오너는 이메일로 초대할 수 있다", async () => {
    const { data, error } = await owner.client.rpc("invite_to_space", {
      p_space_id: spaceId, p_email: outsider.email.toUpperCase(), p_role: "viewer",
    });
    expect(error).toBeNull();
    expect(typeof data).toBe("string");
    // 이메일은 소문자로 정규화 저장
    const { data: inv } = await admin.from("space_invitations").select().eq("id", data);
    expect(inv![0].invitee_email).toBe(outsider.email.toLowerCase());
  });

  it("editor는 초대할 수 없다(오너 전용)", async () => {
    const { error } = await editor.client.rpc("invite_to_space", {
      p_space_id: spaceId, p_email: "x@test.local", p_role: "viewer",
    });
    expect(error).not.toBeNull();
  });

  it("이미 멤버인 사람은 초대할 수 없다", async () => {
    const { error } = await owner.client.rpc("invite_to_space", {
      p_space_id: spaceId, p_email: editor.email, p_role: "viewer",
    });
    expect(error).not.toBeNull();
  });

  it("초대받은 사람은 목록에서 자기 초대를 보고 수락하면 멤버가 된다", async () => {
    const { data: seen } = await outsider.client.from("space_invitations").select().eq("space_id", spaceId);
    expect(seen!.length).toBe(1);
    const invId = seen![0].id;
    const { error } = await outsider.client.rpc("accept_invitation", { p_invitation_id: invId });
    expect(error).toBeNull();
    const { data: mem } = await admin.from("space_members").select().eq("space_id", spaceId).eq("user_id", outsider.id);
    expect(mem![0].role).toBe("viewer");
    const { data: inv } = await admin.from("space_invitations").select("status").eq("id", invId).single();
    expect(inv!.status).toBe("accepted");
    // 정리
    await admin.from("space_members").delete().eq("space_id", spaceId).eq("user_id", outsider.id);
  });

  it("남의 이메일 초대는 수락할 수 없다", async () => {
    const { data: id } = await owner.client.rpc("invite_to_space", { p_space_id: spaceId, p_email: "someone@test.local", p_role: "viewer" });
    const { error } = await outsider.client.rpc("accept_invitation", { p_invitation_id: id });
    expect(error).not.toBeNull();
    await admin.from("space_invitations").delete().eq("id", id);
  });

  it("초대받은 사람은 거절할 수 있고, 거절 후에는 수락할 수 없다", async () => {
    await admin.from("space_members").delete().eq("space_id", spaceId).eq("user_id", outsider.id);
    const { data: id } = await owner.client.rpc("invite_to_space", { p_space_id: spaceId, p_email: outsider.email, p_role: "viewer" });
    const { error: dErr } = await outsider.client.rpc("decline_invitation", { p_invitation_id: id });
    expect(dErr).toBeNull();
    const { data: inv } = await admin.from("space_invitations").select("status").eq("id", id).single();
    expect(inv!.status).toBe("declined");
    const { error: aErr } = await outsider.client.rpc("accept_invitation", { p_invitation_id: id });
    expect(aErr).not.toBeNull();
    await admin.from("space_invitations").delete().eq("id", id);
  });

  it("viewer는 공유 스페이스 컬렉션에 공유 코드를 발급할 수 없다", async () => {
    await admin.from("space_members").upsert({ space_id: spaceId, user_id: viewer.id, role: "viewer" });
    const { data: c } = await admin.from("collections")
      .insert({ user_id: owner.id, space_id: spaceId, title: "viewer 코드 시도" }).select().single();
    const { error } = await viewer.client.rpc("create_collection_share_code", { p_collection_id: c!.id });
    expect(error).not.toBeNull();
  });
});

describe("2단계 RPC 공유 스페이스 확장", () => {
  it("editor는 공유 스페이스의 컬렉션에 공유 코드를 발급할 수 있다", async () => {
    const { data: c } = await owner.client.from("collections")
      .insert({ user_id: owner.id, space_id: spaceId, title: "코드용" }).select().single();
    const { error } = await editor.client.rpc("create_collection_share_code", { p_collection_id: c!.id });
    expect(error).toBeNull();
    await owner.client.from("collections").delete().eq("id", c!.id);
  });

  it("editor는 공유 스페이스로 컬렉션을 복사할 수 있다", async () => {
    const { data: myCol } = await editor.client.from("collections")
      .insert({ user_id: editor.id, space_id: spaceId, title: "editor 원본" }).select().single();
    const { error } = await editor.client.rpc("copy_collection", { p_collection_id: myCol!.id, p_target_space_id: spaceId });
    expect(error).toBeNull();
  });

  it("viewer는 공유 스페이스로 복사할 수 없다(편집권 없음)", async () => {
    const { data: c } = await admin.from("collections")
      .insert({ user_id: owner.id, space_id: spaceId, title: "viewer 복사 시도 원본" }).select().single();
    const { error } = await viewer.client.rpc("copy_collection", { p_collection_id: c!.id, p_target_space_id: spaceId });
    expect(error).not.toBeNull();
  });
});

describe("core 데이터 함수", () => {
  it("listMembers는 프로필과 함께 멤버를 돌려준다", async () => {
    await admin.from("space_members").upsert([
      { space_id: spaceId, user_id: editor.id, role: "editor" },
      { space_id: spaceId, user_id: viewer.id, role: "viewer" },
    ]);
    const members = await listMembers(owner.client, spaceId);
    expect(members.length).toBe(2);
    expect(members[0]).toHaveProperty("display_name");
    expect(members[0]).toHaveProperty("role");
  });

  it("오너는 멤버 role을 바꿀 수 있다", async () => {
    await updateMemberRole(owner.client, spaceId, viewer.id, "editor");
    const { data } = await admin.from("space_members").select("role").eq("space_id", spaceId).eq("user_id", viewer.id).single();
    expect(data!.role).toBe("editor");
    await updateMemberRole(owner.client, spaceId, viewer.id, "viewer"); // 복구
  });

  it("초대 → 내 초대 목록 → 수락 전체 흐름", async () => {
    const id = await inviteToSpace(owner.client, spaceId, outsider.email, "viewer");
    expect(typeof id).toBe("string");
    const mine = await listMyInvitations(outsider.client);
    expect(mine.some((i) => i.id === id)).toBe(true);
    expect(mine.find((i) => i.id === id)!.space_name).toBe("공유 스페이스");
    await acceptInvitation(outsider.client, id);
    const memberships = await listMyMemberships(outsider.client);
    expect(memberships.some((m) => m.space_id === spaceId)).toBe(true);
    // 정리
    await leaveSpace(outsider.client, spaceId, outsider.id);
  });

  it("오너는 대기 중 초대를 취소할 수 있다", async () => {
    const id = await inviteToSpace(owner.client, spaceId, "tocancel@test.local", "viewer");
    await cancelInvitation(owner.client, id);
    const list = await listSpaceInvitations(owner.client, spaceId);
    expect(list.some((i) => i.id === id)).toBe(false);
  });
});
