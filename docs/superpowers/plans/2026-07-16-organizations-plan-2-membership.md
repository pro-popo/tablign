# 조직 멤버십(Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 팀 조직에 이메일로 멤버(admin/member)를 초대·관리하고, 스페이스 패널 헤더에 조직명·멤버 아바타·내 역할칩·설정(⚙️)을 노출해 협업 상태를 보여준다.

**Architecture:** Phase 1이 만든 `organization_members`/`organization_invitations` 테이블·RLS·role-guard 트리거 위에, security-definer RPC(초대 생성/수락/거절/내 초대 조회)를 얹어 기존 space 공유(`invite_to_space` 등)와 대칭 구조로 만든다. 클라이언트는 기존 `MemberDialog`/`InvitationList`를 역할-무관하게 일반화해 재사용하고, `MemberAvatars`는 그대로 쓴다.

**Tech Stack:** Supabase(Postgres + RLS + security-definer RPC), TypeScript(`@tablign/core`), React(`@tablign/ui`, 익스텐션 새 탭), Vitest.

## Global Constraints

- 커밋 컨벤션: `[타입] 명사형` Korean (예: `[기능] 조직 초대 RPC`). `feat(scope):` 금지.
- 마이그레이션 번호: Phase 1이 `0017`까지 썼으므로 `0018`부터.
- **테스트 DB는 로컬**(`packages/core/.env.test` → `http://127.0.0.1:54321`). 새 마이그레이션은 **로컬(`supabase migration up --local` 또는 `db reset`) + 원격(`supabase db push`, ref `njteyuixwdsclsrpcvqt`) 둘 다** 적용. 스키마 캐시 지연 시 `NOTIFY pgrst, 'reload schema';`.
- 조직 역할: `admin` / `member` (오너는 `organizations.owner_id`, 멤버 테이블에 없음). 역할 라벨: **소유자 / 관리자 / 멤버**. 역할칩 색: 소유자 `배경 #fff4e6 / 글자 #e8590c`, 관리자 `#edf0fe / #3b5bdb`, 멤버 `#f1f3f5 / #868e96`.
- RPC는 기존 `invite_to_space`(0012)·`accept_invitation`·`decline_invitation`·`get_my_invitations`(0013) 패턴을 그대로 미러링: `security definer`, `revoke ... from public, anon; grant execute ... to authenticated`.
- 권한 규칙(Phase 1 RLS와 일치): 초대·멤버 관리는 **owner·admin**(`can_edit_org`), member는 읽기 전용. role 셀프 승격은 Phase 1의 `organization_members_role_guard`가 차단.
- 테두리 있는 레이아웃 요소엔 `boxSizing:"border-box"` 명시.
- `organization_members`에는 INSERT RLS 정책이 없다(Phase 1). 멤버 추가는 오직 `accept_org_invitation` RPC 경유.

---

### Task 1: 조직 초대 RPC (invite/accept/decline/get_my)

**Files:**
- Create: `supabase/migrations/0018_org_invitations_rpc.sql`
- Modify: `packages/core/src/__tests__/org.test.ts`

**Interfaces:**
- Consumes: `organizations`, `organization_members`, `organization_invitations`, `can_edit_org`(Phase 1).
- Produces (RPC):
  - `invite_to_org(p_org_id uuid, p_email text, p_role text) returns uuid`
  - `accept_org_invitation(p_invitation_id uuid) returns void`
  - `decline_org_invitation(p_invitation_id uuid) returns void`
  - `get_my_org_invitations() returns table(id uuid, org_id uuid, inviter_id uuid, invitee_email text, role text, status text, created_at timestamptz, org_name text)`

- [ ] **Step 1: 마이그레이션 작성 (invite_to_space/accept/decline/get_my 미러링)**

Create `supabase/migrations/0018_org_invitations_rpc.sql`:

```sql
-- 조직 초대 RPC — invite_to_space(0012)·get_my_invitations(0013) 대칭

-- 초대 생성: owner·admin만, 자기 자신·기존 멤버·오너 초대 차단, 이메일 소문자 정규화
create function public.invite_to_org(p_org_id uuid, p_email text, p_role text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(p_email);
  v_invitee uuid;
  v_id uuid;
begin
  if p_role not in ('admin','member') then raise exception 'invalid role'; end if;
  if not public.can_edit_org(p_org_id) then raise exception 'only owner or admin can invite'; end if;
  if v_email = lower(coalesce(auth.jwt() ->> 'email','')) then raise exception 'cannot invite yourself'; end if;

  select id into v_invitee from auth.users where lower(email) = v_email;
  if v_invitee is not null then
    if exists (select 1 from organizations where id = p_org_id and owner_id = v_invitee) then
      raise exception 'user is already the owner';
    end if;
    if exists (select 1 from organization_members where org_id = p_org_id and user_id = v_invitee) then
      raise exception 'user is already a member';
    end if;
  end if;

  insert into organization_invitations (org_id, inviter_id, invitee_email, role)
  values (p_org_id, v_uid, v_email, p_role)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.invite_to_org(uuid, text, text) from public, anon;
grant execute on function public.invite_to_org(uuid, text, text) to authenticated;

-- 수락: 호출자 이메일 = 초대 이메일 검증 → 멤버 insert + status 갱신 (멱등)
create function public.accept_org_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email',''));
  v_inv organization_invitations;
begin
  select * into v_inv from organization_invitations where id = p_invitation_id;
  if v_inv is null or lower(v_inv.invitee_email) <> v_email then
    raise exception 'invitation not found';
  end if;
  if v_inv.status = 'declined' then raise exception 'invitation already declined'; end if;
  insert into organization_members (org_id, user_id, role)
  values (v_inv.org_id, v_uid, v_inv.role)
  on conflict (org_id, user_id) do nothing;
  update organization_invitations set status = 'accepted' where id = p_invitation_id;
end;
$$;
revoke execute on function public.accept_org_invitation(uuid) from public, anon;
grant execute on function public.accept_org_invitation(uuid) to authenticated;

-- 거절
create function public.decline_org_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email',''));
  v_inv organization_invitations;
begin
  select * into v_inv from organization_invitations where id = p_invitation_id;
  if v_inv is null or lower(v_inv.invitee_email) <> v_email then
    raise exception 'invitation not found';
  end if;
  update organization_invitations set status = 'declined' where id = p_invitation_id;
end;
$$;
revoke execute on function public.decline_org_invitation(uuid) from public, anon;
grant execute on function public.decline_org_invitation(uuid) to authenticated;

-- 나에게 온 pending 초대 (조직 이름 포함) — 초대받은 사람은 아직 org 멤버가 아니라 organizations RLS 미통과
create function public.get_my_org_invitations()
returns table(id uuid, org_id uuid, inviter_id uuid, invitee_email text, role text, status text, created_at timestamptz, org_name text)
language sql security definer stable set search_path = public as $$
  select oi.id, oi.org_id, oi.inviter_id, oi.invitee_email, oi.role, oi.status, oi.created_at, o.name as org_name
  from organization_invitations oi
  join organizations o on o.id = oi.org_id
  where oi.status = 'pending'
    and lower(oi.invitee_email) = lower(coalesce(auth.jwt() ->> 'email',''))
  order by oi.created_at desc;
$$;
revoke execute on function public.get_my_org_invitations() from public, anon;
grant execute on function public.get_my_org_invitations() to authenticated;
```

- [ ] **Step 2: 로컬+원격 적용**

Run: `supabase migration up --local` then `supabase db push`
Expected: `0018` 적용 성공 (양쪽).

- [ ] **Step 3: 실패하는 테스트 작성**

Append to `packages/core/src/__tests__/org.test.ts` (reuses `owner`/`adminMember`/`member`/`outsider`/`orgId` fixtures):

```ts
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
```

- [ ] **Step 4: 테스트 실행** — Run: `pnpm --filter @tablign/core test org.test.ts` → PASS.

- [ ] **Step 5: 커밋**
```bash
git add supabase/migrations/0018_org_invitations_rpc.sql packages/core/src/__tests__/org.test.ts
git commit -m "[기능] 조직 초대 RPC"
```

---

### Task 2: core 데이터 계층 — 조직 멤버·초대

**Files:**
- Create: `packages/core/src/data/org-members.ts`
- Create: `packages/core/src/data/org-invitations.ts`
- Modify: `packages/core/src/types.ts` (조인 결과 타입)
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/__tests__/org.test.ts`

**Interfaces:**
- Produces (types):
  - `interface OrgMemberWithProfile extends OrganizationMember { display_name: string | null; avatar_url: string | null }`
  - `interface OrgInvitationWithOrg extends OrganizationInvitation { org_name: string; inviter_name: string | null }`
- Produces (org-members.ts):
  - `listOrgMembers(client, orgId: string): Promise<OrgMemberWithProfile[]>`
  - `removeOrgMember(client, orgId: string, userId: string): Promise<void>`
  - `updateOrgMemberRole(client, orgId: string, userId: string, role: "admin" | "member"): Promise<void>`
  - `leaveOrg(client, orgId: string, userId: string): Promise<void>`
- Produces (org-invitations.ts):
  - `inviteToOrg(client, orgId: string, email: string, role: "admin" | "member"): Promise<string>`
  - `listOrgInvitations(client, orgId: string): Promise<OrganizationInvitation[]>`
  - `listMyOrgInvitations(client): Promise<OrgInvitationWithOrg[]>`
  - `acceptOrgInvitation(client, id: string): Promise<void>`
  - `declineOrgInvitation(client, id: string): Promise<void>`
  - `cancelOrgInvitation(client, id: string): Promise<void>`

- [ ] **Step 1: 타입 추가** — Append to `packages/core/src/types.ts`:
```ts
export interface OrgMemberWithProfile extends OrganizationMember {
  display_name: string | null;
  avatar_url: string | null;
}
export interface OrgInvitationWithOrg extends OrganizationInvitation {
  org_name: string;
  inviter_name: string | null;
}
```

- [ ] **Step 2: org-members.ts (members.ts 패턴 복제 — profiles는 별도 쿼리 merge)** — Create `packages/core/src/data/org-members.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationMember, OrgMemberWithProfile } from "../types";

/** 조직 멤버 목록(프로필 merge, position 오름차순). 오너는 미포함(members 테이블에 없음). */
export async function listOrgMembers(client: SupabaseClient, orgId: string): Promise<OrgMemberWithProfile[]> {
  const { data: members, error } = await client
    .from("organization_members")
    .select("org_id, user_id, role, position, created_at")
    .eq("org_id", orgId)
    .order("position", { ascending: true });
  if (error) throw error;
  if (!members || members.length === 0) return [];
  const userIds = (members as OrganizationMember[]).map((m) => m.user_id);
  const { data: profiles, error: pErr } = await client
    .from("profiles").select("id, display_name, avatar_url").in("id", userIds);
  if (pErr) throw pErr;
  const map = new Map<string, { display_name: string | null; avatar_url: string | null }>();
  for (const p of profiles ?? []) {
    const pr = p as { id: string; display_name: string | null; avatar_url: string | null };
    map.set(pr.id, { display_name: pr.display_name, avatar_url: pr.avatar_url });
  }
  return (members as OrganizationMember[]).map((m) => ({
    ...m, display_name: map.get(m.user_id)?.display_name ?? null, avatar_url: map.get(m.user_id)?.avatar_url ?? null,
  }));
}

export async function removeOrgMember(client: SupabaseClient, orgId: string, userId: string): Promise<void> {
  const { error } = await client.from("organization_members").delete().eq("org_id", orgId).eq("user_id", userId);
  if (error) throw error;
}

export async function updateOrgMemberRole(client: SupabaseClient, orgId: string, userId: string, role: "admin" | "member"): Promise<void> {
  const { error } = await client.from("organization_members").update({ role }).eq("org_id", orgId).eq("user_id", userId);
  if (error) throw error;
}

export async function leaveOrg(client: SupabaseClient, orgId: string, userId: string): Promise<void> {
  const { error } = await client.from("organization_members").delete().eq("org_id", orgId).eq("user_id", userId);
  if (error) throw error;
}
```

- [ ] **Step 3: org-invitations.ts (invitations.ts 패턴 복제)** — Create `packages/core/src/data/org-invitations.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationInvitation, OrgInvitationWithOrg } from "../types";

export async function inviteToOrg(client: SupabaseClient, orgId: string, email: string, role: "admin" | "member"): Promise<string> {
  const { data, error } = await client.rpc("invite_to_org", { p_org_id: orgId, p_email: email, p_role: role });
  if (error) throw error;
  return data as string;
}

export async function listOrgInvitations(client: SupabaseClient, orgId: string): Promise<OrganizationInvitation[]> {
  const { data, error } = await client
    .from("organization_invitations").select().eq("org_id", orgId).eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as OrganizationInvitation[];
}

export async function listMyOrgInvitations(client: SupabaseClient): Promise<OrgInvitationWithOrg[]> {
  const { data, error } = await client.rpc("get_my_org_invitations");
  if (error) throw error;
  return (data as unknown[]).map((row) => {
    const r = row as OrganizationInvitation & { org_name: string };
    return { ...r, org_name: r.org_name ?? "", inviter_name: null };
  });
}

export async function acceptOrgInvitation(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc("accept_org_invitation", { p_invitation_id: id });
  if (error) throw error;
}

export async function declineOrgInvitation(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.rpc("decline_org_invitation", { p_invitation_id: id });
  if (error) throw error;
}

export async function cancelOrgInvitation(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("organization_invitations").delete().eq("id", id).eq("status", "pending");
  if (error) throw error;
}
```

- [ ] **Step 4: export** — Add to `packages/core/src/index.ts`:
```ts
export * from "./data/org-members";
export * from "./data/org-invitations";
```

- [ ] **Step 5: 테스트 (데이터 계층 왕복)** — Append to `org.test.ts` (import the new fns):
```ts
import { listOrgMembers, updateOrgMemberRole } from "../data/org-members";
import { inviteToOrg, listOrgInvitations, listMyOrgInvitations, acceptOrgInvitation, cancelOrgInvitation } from "../data/org-invitations";
```
```ts
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
```

- [ ] **Step 6: 테스트 + 타입체크** — Run `pnpm --filter @tablign/core test org.test.ts` (PASS) and `pnpm --filter @tablign/core lint` (clean).

- [ ] **Step 7: 커밋**
```bash
git add packages/core/src/data/org-members.ts packages/core/src/data/org-invitations.ts packages/core/src/types.ts packages/core/src/index.ts packages/core/src/__tests__/org.test.ts
git commit -m "[기능] 조직 멤버·초대 데이터 계층"
```

---

### Task 3: 멤버 다이얼로그·초대 목록을 역할-무관하게 일반화

**Files:**
- Modify: `packages/ui/src/MemberDialog.tsx`
- Modify: `packages/ui/src/InvitationList.tsx`
- Modify: `apps/extension/src/newtab/NewTab.tsx` (기존 space 공유 호출부를 새 API로 갱신)

**Rationale:** 두 컴포넌트는 역할이 `"editor"|"viewer"`로 하드코딩돼 있다. 조직(admin/member)에도 쓰려면 역할 집합을 주입받게 일반화한다(DRY — spec "기존 UI 재사용"). `MemberAvatars`는 역할 무관이라 수정 불필요.

**Interfaces:**
- Produces (MemberDialog): props에 `roles: { value: string; label: string }[]` 추가. `MemberRow.role`/`InviteRow.role`/`onInvite`/`onChangeRole`을 `string`으로 일반화. 내부 `ROLE_LABEL` 상수 제거 → `roles`에서 라벨 조회.
- Produces (InvitationList): `InvitationItem.role`을 `string`으로, `roles` prop 추가(라벨 매핑). `space_name`은 이미 범용 문자열이므로 유지(초대 대상 이름).

- [ ] **Step 1: MemberDialog 일반화**

Modify `packages/ui/src/MemberDialog.tsx`:
```ts
export interface MemberRow { user_id: string; role: string; display_name: string | null; avatar_url: string | null }
export interface InviteRow { id: string; invitee_email: string; role: string }
export interface RoleOption { value: string; label: string }
export interface MemberDialogProps {
  open: boolean;
  spaceName: string;               // 다이얼로그 제목(스페이스/조직 이름 공용)
  roles: RoleOption[];             // 선택 가능한 역할 (예: editor/viewer 또는 admin/member)
  members: MemberRow[];
  pendingInvites: InviteRow[];
  onInvite: (email: string, role: string) => void;
  onChangeRole: (userId: string, role: string) => void;
  onRemove: (userId: string) => void;
  onCancelInvite: (id: string) => void;
  onClose: () => void;
}
```
- Remove the `ROLE_LABEL` const and the `useState<"editor"|"viewer">`. Replace with `const [role, setRole] = useState<string>(roles[0]?.value ?? "")`, reset to `roles[0]?.value` when `open` toggles.
- Everywhere a role label was shown, look it up: `roles.find(r => r.value === X)?.label ?? X`.
- The role `<select>`/toggle must render options from `roles`.

- [ ] **Step 2: InvitationList 일반화**
```ts
export interface InvitationItem { id: string; space_name: string; inviter_name: string | null; role: string }
export interface InvitationListProps {
  invitations: InvitationItem[];
  roles: { value: string; label: string }[];
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}
```
- Remove `ROLE_LABEL`; render role label via `roles.find(r => r.value === inv.role)?.label ?? inv.role`.

- [ ] **Step 3: 기존 space 공유 호출부 갱신 (NewTab.tsx)**
- Find the existing `<MemberDialog ...>` usage and add `roles={[{ value: "editor", label: "편집자" }, { value: "viewer", label: "뷰어" }]}`.
- Find the existing `<InvitationList ...>` usage (space invitations popover) and add the same `roles`.
- Types now widen to `string`; keep the existing space-role values ("editor"/"viewer") unchanged. No behavior change for space sharing.

- [ ] **Step 4: 빌드/타입체크 + 회귀 테스트**
- Run `pnpm --filter @tablign/ui lint` and `pnpm --filter @tablign/extension build` → clean.
- Run `pnpm --filter @tablign/extension test NewTab.test.tsx` → still green (space member dialog behavior unchanged). Fix the test minimally only if a prop type change requires it.

- [ ] **Step 5: 커밋**
```bash
git add packages/ui/src/MemberDialog.tsx packages/ui/src/InvitationList.tsx apps/extension/src/newtab/NewTab.tsx
git commit -m "[리팩터] 멤버 다이얼로그·초대 목록 역할 일반화"
```

---

### Task 4: 스페이스 패널 협업 헤더 (조직명·멤버·역할칩·⚙️)

**Files:**
- Create: `apps/extension/src/newtab/OrgHeader.tsx`
- Modify: `apps/extension/src/newtab/NewTab.tsx`

**Interfaces:**
- Consumes: `Organization`, `OrgMemberWithProfile`(`@tablign/core`), `MemberAvatars`(`@tablign/ui`).
- Produces:
```ts
export type OrgRole = "owner" | "admin" | "member";
export interface OrgHeaderProps {
  org: Organization;
  members: OrgMemberWithProfile[];  // 팀 조직의 멤버(오너 제외)
  myRole: OrgRole;
  onOpenMembers: () => void;        // ⚙️ → 멤버 관리 다이얼로그
}
export function OrgHeader(props: OrgHeaderProps): JSX.Element;
```

- [ ] **Step 1: OrgHeader 컴포넌트** — Create `apps/extension/src/newtab/OrgHeader.tsx`:
```tsx
import type { Organization, OrgMemberWithProfile } from "@tablign/core";
import { MemberAvatars, theme } from "@tablign/ui";

export type OrgRole = "owner" | "admin" | "member";
const ROLE_CHIP: Record<OrgRole, { label: string; bg: string; fg: string }> = {
  owner:  { label: "소유자", bg: "#fff4e6", fg: "#e8590c" },
  admin:  { label: "관리자", bg: "#edf0fe", fg: "#3b5bdb" },
  member: { label: "멤버",   bg: "#f1f3f5", fg: "#868e96" },
};

export interface OrgHeaderProps {
  org: Organization;
  members: OrgMemberWithProfile[];
  myRole: OrgRole;
  onOpenMembers: () => void;
}

export function OrgHeader({ org, members, myRole, onOpenMembers }: OrgHeaderProps) {
  const chip = ROLE_CHIP[myRole];
  const isPersonal = org.is_personal;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <strong style={{ fontSize: 15, color: theme.text }}>{org.name}</strong>
      {!isPersonal && (
        <>
          {members.length > 0 && <MemberAvatars people={members} />}
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: chip.bg, color: chip.fg, boxSizing: "border-box" }}>
            {chip.label}
          </span>
        </>
      )}
      <button type="button" title={isPersonal ? "조직 설정" : "멤버·설정"} aria-label="조직 설정" onClick={onOpenMembers}
        style={{ marginLeft: 2, border: "none", background: "none", cursor: "pointer", display: "flex", padding: 3, color: theme.textFaint }}>
        {/* lucide settings */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: NewTab에 org 멤버 로드 + myRole 계산 + 헤더 배치**

Modify `apps/extension/src/newtab/NewTab.tsx`:
1. State: `const [orgMembers, setOrgMembers] = useState<OrgMemberWithProfile[]>([]);`
2. Effect — active org의 멤버 로드 (개인 조직이면 skip):
```ts
useEffect(() => {
  const org = organizations.find((o) => o.id === activeOrgId);
  if (!org || org.is_personal) { setOrgMembers([]); return; }
  listOrgMembers(supabase, activeOrgId!).then(setOrgMembers).catch(() => setOrgMembers([]));
}, [activeOrgId, organizations]);
```
3. myRole 계산 (오너=owner, 멤버십의 role, 없으면 member):
```ts
const activeOrg = organizations.find((o) => o.id === activeOrgId) ?? null;
const myOrgRole: OrgRole = activeOrg && session
  ? (activeOrg.owner_id === session.user.id ? "owner"
     : (orgMemberships.find((m) => m.org_id === activeOrgId)?.role ?? "member"))
  : "member";
```
4. Board 헤더의 스페이스 이름 표시(`<strong>{spaces.find(...)?.name}</strong>` + 초대/멤버 버튼 영역)를 `activeOrg`가 있으면 `OrgHeader`로 대체. 기존 스페이스 이름·컬렉션 개수 표시는 그 아래(또는 우측)로 유지. `onOpenMembers`는 조직 멤버 관리 다이얼로그를 연다(Task 5).
5. Import `listOrgMembers`, `type OrgMemberWithProfile`, `OrgHeader`, `type OrgRole`.

> `import { OrgHeader, type OrgRole } from "./OrgHeader";`

- [ ] **Step 3: 빌드/타입체크** — Run `pnpm --filter @tablign/extension build` → clean.

- [ ] **Step 4: 커밋**
```bash
git add apps/extension/src/newtab/OrgHeader.tsx apps/extension/src/newtab/NewTab.tsx
git commit -m "[기능] 스페이스 패널 협업 헤더"
```

---

### Task 5: 조직 멤버 관리 다이얼로그 + 초대 알림 통합

**Files:**
- Modify: `apps/extension/src/newtab/NewTab.tsx`

**Interfaces:**
- Consumes: `MemberDialog`(일반화, Task 3), `InvitationList`(일반화), `listOrgMembers`/`removeOrgMember`/`updateOrgMemberRole`, `inviteToOrg`/`listOrgInvitations`/`cancelOrgInvitation`/`listMyOrgInvitations`/`acceptOrgInvitation`/`declineOrgInvitation`.

- [ ] **Step 1: 조직 멤버 관리 다이얼로그 상태·핸들러**

Add to `NewTab.tsx`:
```ts
const [orgMemberDialogOpen, setOrgMemberDialogOpen] = useState(false);
const [orgPendingInvites, setOrgPendingInvites] = useState<OrganizationInvitation[]>([]);

async function openOrgMemberDialog() {
  if (!activeOrgId) return;
  setOrgMemberDialogOpen(true);
  const [ms, invs] = await Promise.all([listOrgMembers(supabase, activeOrgId), listOrgInvitations(supabase, activeOrgId)]);
  setOrgMembers(ms); setOrgPendingInvites(invs);
}
async function reloadOrgMembers() {
  if (!activeOrgId) return;
  const [ms, invs] = await Promise.all([listOrgMembers(supabase, activeOrgId), listOrgInvitations(supabase, activeOrgId)]);
  setOrgMembers(ms); setOrgPendingInvites(invs);
}
async function handleOrgInvite(email: string, role: string) {
  try { await inviteToOrg(supabase, activeOrgId!, email, role as "admin" | "member"); toast.show("초대를 보냈어요"); reloadOrgMembers(); }
  catch (e) { console.error(e); toast.show("초대하지 못했어요. 이미 멤버이거나 잘못된 이메일일 수 있어요."); }
}
```
Wire `OrgHeader`'s `onOpenMembers={openOrgMemberDialog}` (Task 4).

- [ ] **Step 2: MemberDialog(조직용) 렌더** — Add a second `<MemberDialog>` for orgs:
```tsx
<MemberDialog
  open={orgMemberDialogOpen}
  spaceName={activeOrg?.name ?? ""}
  roles={[{ value: "admin", label: "관리자" }, { value: "member", label: "멤버" }]}
  members={orgMembers.map((m) => ({ user_id: m.user_id, role: m.role, display_name: m.display_name, avatar_url: m.avatar_url }))}
  pendingInvites={orgPendingInvites.map((i) => ({ id: i.id, invitee_email: i.invitee_email, role: i.role }))}
  onInvite={handleOrgInvite}
  onChangeRole={async (uid, role) => { try { await updateOrgMemberRole(supabase, activeOrgId!, uid, role as "admin" | "member"); reloadOrgMembers(); } catch (e) { console.error(e); toast.show("역할을 변경하지 못했어요."); } }}
  onRemove={async (uid) => { try { await removeOrgMember(supabase, activeOrgId!, uid); reloadOrgMembers(); } catch (e) { console.error(e); toast.show("멤버를 제거하지 못했어요."); } }}
  onCancelInvite={async (id) => { try { await cancelOrgInvitation(supabase, id); reloadOrgMembers(); } catch (e) { console.error(e); toast.show("초대를 취소하지 못했어요."); } }}
  onClose={() => setOrgMemberDialogOpen(false)}
/>
```
Only allow opening when `myOrgRole` is owner/admin (member sees no ⚙️ member management — pass a read-only affordance or hide invite for member; MVP: OrgHeader always shows ⚙️ but for `member` the dialog opens read-only — simplest is to still show members list; invite/role/remove calls will fail RLS. To avoid confusing errors, hide invite/role/remove controls when `myOrgRole === "member"`: pass a `readOnly` — NOT in MemberDialog API. MVP scope: only render ⚙️ when `myOrgRole !== "member"` in OrgHeader). **Update OrgHeader Step: render ⚙️ only when `myRole !== "member"`.**

- [ ] **Step 3: 받은 조직 초대 알림 통합**

The existing "초대" popover shows space invitations via `myInvitations`/`InvitationList`. Add org invitations alongside:
```ts
const [myOrgInvitations, setMyOrgInvitations] = useState<OrgInvitationWithOrg[]>([]);
useEffect(() => { if (!session) return; listMyOrgInvitations(supabase).then(setMyOrgInvitations).catch(console.error); }, [session]);
```
- In the invite popover, render a second `<InvitationList>` (or merge into one) for org invitations with `roles={[{value:"admin",label:"관리자"},{value:"member",label:"멤버"}]}`, mapping `space_name: i.org_name`.
- The badge count on the "초대" button becomes `myInvitations.length + myOrgInvitations.length`.
- `onAccept`: `await acceptOrgInvitation(supabase, id)` then reload orgs + memberships + org invitations (so the new org appears in the rail): call the existing `refreshAll` pattern extended to also refresh organizations:
```ts
async function acceptOrgInv(id: string) {
  await acceptOrgInvitation(supabase, id);
  const [orgs, oms, oInvs] = await Promise.all([listOrganizations(supabase), listMyOrgMemberships(supabase), listMyOrgInvitations(supabase)]);
  setOrganizations(orgs); setOrgMemberships(oms); setMyOrgInvitations(oInvs);
  toast.show("조직에 참여했어요");
}
```
- `onDecline`: `await declineOrgInvitation(supabase, id)` then drop from `myOrgInvitations`.

- [ ] **Step 4: viewer(=member) 편집 진입점 억제**
- Board 헤더의 "컬렉션 추가"·컬렉션 편집 등은 이미 `canEdit`로 게이트됨(space 기준). 조직 스페이스에서 `canEdit`는 `can_edit_space`(RLS)가 최종 방어선이나, UI 1차 방어선으로 `myOrgRole === "member"`면 조직 스페이스 편집 진입점을 숨긴다. 기존 `canEdit` 계산에 조직 역할을 반영: 활성 스페이스가 조직 스페이스일 때 `canEdit = myOrgRole !== "member"` (개인/공유 스페이스는 기존 로직 유지).

- [ ] **Step 5: 빌드 + 커밋**
- Run `pnpm --filter @tablign/extension build` → clean.
```bash
git add apps/extension/src/newtab/NewTab.tsx apps/extension/src/newtab/OrgHeader.tsx
git commit -m "[기능] 조직 멤버 관리·초대 알림 통합"
```

---

### Task 6: Realtime 구독 + NewTab 테스트 갱신

**Files:**
- Modify: `apps/extension/src/newtab/NewTab.tsx`
- Modify: `apps/extension/src/newtab/NewTab.test.tsx`

- [ ] **Step 1: Realtime — 조직 멤버/초대 변경 시 반영**
- Phase 1에서 `organizations`/`organization_members`/`organization_invitations`는 이미 publication에 추가됨. 기존 스페이스 협업 realtime 구독 패턴을 따라(있으면), 활성 조직의 멤버 변경 시 `reloadOrgMembers()`를, 내 초대 변경 시 `listMyOrgInvitations`를 재조회하는 구독을 추가한다. 기존에 realtime 구독 코드가 없다면 MVP로 스킵하고, 초대 수락/멤버 변경 후 수동 재조회(이미 각 핸들러에 있음)로 충분함을 report에 명시.

- [ ] **Step 2: NewTab.test.tsx mock 보강**
- `@tablign/core` mock에 추가: `listOrgMembers: vi.fn().mockResolvedValue([])`, `inviteToOrg: vi.fn()`, `listOrgInvitations: vi.fn().mockResolvedValue([])`, `listMyOrgInvitations: vi.fn().mockResolvedValue([])`, `acceptOrgInvitation`/`declineOrgInvitation`/`cancelOrgInvitation`/`removeOrgMember`/`updateOrgMemberRole`: `vi.fn()`.
- 기존 personal-org mock(`is_personal:true`)은 `OrgHeader`가 개인 조직에선 멤버/역할칩을 안 그리므로 추가 조정 불필요. 팀 조직 렌더 경로를 테스트하려면 별도 it에서 `listOrganizations` mock에 팀 조직을 하나 더 넣고 활성 조직을 그걸로 설정(선택).

- [ ] **Step 3: 전체 회귀** — Run `pnpm --filter @tablign/extension test NewTab.test.tsx` (PASS) then `pnpm test` (전체 PASS).

- [ ] **Step 4: 커밋**
```bash
git add apps/extension/src/newtab/NewTab.tsx apps/extension/src/newtab/NewTab.test.tsx
git commit -m "[기능] 조직 Realtime·테스트 갱신"
```

---

## Self-Review

**Spec coverage (스펙 §5-3 공유 스페이스 협업 → 조직 맥락):**
- 이메일 초대 RPC → Task 1
- 멤버·초대 데이터 계층 → Task 2
- 멤버 관리 다이얼로그(재사용) → Task 3, 5
- 협업 헤더(조직명·멤버 아바타·역할칩·⚙️) → Task 4
- 초대 알림 통합·수락 후 레일 등장 → Task 5
- viewer(member) 편집 억제 → Task 5 Step 4 (RLS 최종 방어선은 Phase 1)
- Realtime → Task 6

**Placeholder scan:** 구체 SQL·TS·TSX 포함. Task 3/5는 기존 파일 구조 의존부(NewTab의 기존 MemberDialog/InvitationList 위치)를 "찾아서 갱신"으로 지시 — 라인이 유동적이라 주변 코드 매칭으로 안내.

**Type consistency:** `OrgRole`(owner/admin/member)은 UI 표시용, DB/데이터 계층 role은 `admin|member`(owner는 owner_id). MemberDialog/InvitationList는 Task 3에서 role을 `string`으로 일반화 → 조직(admin/member)·스페이스(editor/viewer) 양쪽 수용. `OrgMemberWithProfile`/`OrgInvitationWithOrg` 필드가 Task 2 정의와 Task 4/5 사용처에서 일치.

**주의(실행 시):**
- Task 3의 UI 일반화가 기존 space 공유를 깨지 않는지 — Task 3 Step 4에서 NewTab.test로 회귀 확인.
- 마이그레이션 0018은 로컬+원격 둘 다 적용(Phase 1 교훈).
- 멤버(member)가 ⚙️로 관리 다이얼로그를 열어 invite/remove 시도 시 RLS가 막지만, UI에서 member에겐 ⚙️를 숨겨(OrgHeader) 혼란 방지.
