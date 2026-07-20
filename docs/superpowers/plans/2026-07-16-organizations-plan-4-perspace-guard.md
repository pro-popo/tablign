# per-space 공유 제한 가드(Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 per-space 공유(스페이스 이메일 초대 → `space_members`)를 **개인 조직 스페이스에만** 허용한다. 팀 조직 스페이스는 조직 멤버십으로만 협업하고, 개별 초대는 서버에서 차단 + UI에서 진입점을 숨긴다.

**Architecture:** `space_invitations` insert의 유일 경로인 `invite_to_space` RPC(0012)에 "대상 스페이스가 개인 조직인가"(`is_personal_org_space`, Phase 1에 이미 존재) 조건을 추가한다. 방어적 이중화로 `space_members`에 `before insert` 트리거를 걸어 팀 조직 스페이스 멤버 추가를 거부한다. UI는 팀 조직 스페이스에서 per-space "멤버" 진입점을 숨긴다.

**Tech Stack:** Supabase(Postgres + security-definer RPC + 트리거), React(익스텐션 새 탭), Vitest.

## Global Constraints

- 커밋 컨벤션: `[타입] 명사형` Korean; `feat(scope):` 금지.
- 마이그레이션 번호: Phase 3가 `0020`까지 썼으므로 `0021`부터.
- **테스트 DB는 로컬**(`packages/core/.env.test` → `http://127.0.0.1:54321`). 새 마이그레이션은 **로컬(`supabase migration up --local`) + 원격(`supabase db push`, ref `njteyuixwdsclsrpcvqt`) 둘 다** 적용. 스키마 캐시 지연 시 `NOTIFY pgrst, 'reload schema';`.
- `is_personal_org_space(p_space_id)` 헬퍼는 Phase 1(`0014`)에 이미 존재(plpgsql, 개인 조직 여부 반환) — 재사용.
- 기존 개인 스페이스 per-space 공유는 **그대로 동작해야 함**(회귀 금지): 개인 조직 스페이스는 백필로 `is_personal=true` 조직에 속하므로 가드를 통과한다.

---

### Task 1: invite_to_space 가드 + space_members insert 트리거

**Files:**
- Create: `supabase/migrations/0021_perspace_personal_only.sql`
- Modify: `packages/core/src/__tests__/org.test.ts` (또는 share-space.test.ts) — 가드 테스트

**Interfaces:**
- Consumes: `is_personal_org_space`(0014), `invite_to_space`(0012), `space_members`(0010).
- Produces: `invite_to_space`에 개인 조직 가드 추가(재정의); `guard_space_member_org()` + `space_members_personal_org_guard` 트리거.

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/0021_perspace_personal_only.sql`. Read `0012_share_space_rpc.sql` first to copy the CURRENT `invite_to_space` body verbatim, then add ONE guard line. (Recreate the whole function via `create or replace` with the existing body + the new check.)

```sql
-- per-space 공유는 개인 조직 스페이스에만 허용. 팀 조직 스페이스는 조직 멤버십으로만.

-- 1) invite_to_space에 개인 조직 가드 추가 (기존 0012 본문 + 오너 체크 다음 한 줄).
create or replace function public.invite_to_space(p_space_id uuid, p_email text, p_role text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(p_email);
  v_invitee uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if coalesce(auth.jwt() ->> 'email', '') = '' then raise exception 'caller email required'; end if;
  if p_role not in ('editor', 'viewer') then raise exception 'invalid role'; end if;
  if not public.is_space_owner(p_space_id) then raise exception 'only the owner can invite'; end if;
  -- Phase 4: 팀 조직 스페이스는 per-space 초대 불가 (조직 멤버십으로 협업)
  if not public.is_personal_org_space(p_space_id) then
    raise exception 'team-org spaces are shared via organization membership, not per-space invite';
  end if;
  if v_email = lower(coalesce(auth.jwt() ->> 'email', '')) then raise exception 'cannot invite yourself'; end if;
  select id into v_invitee from auth.users where lower(email) = v_email;
  if v_invitee is not null and exists (
    select 1 from space_members where space_id = p_space_id and user_id = v_invitee
  ) then
    raise exception 'already a member';
  end if;
  insert into space_invitations (space_id, inviter_id, invitee_email, role)
  values (p_space_id, v_uid, v_email, p_role)
  returning id into v_id;
  return v_id;
end;
$$;
-- (grant/revoke는 0012에서 이미 authenticated로 설정됨 — create or replace는 유지)

-- 2) 방어적 이중화: space_members insert 시 대상 스페이스가 개인 조직이 아니면 거부.
--    (accept_invitation RPC가 유일한 insert 경로지만, 만일을 대비.)
create function public.guard_space_member_org() returns trigger
  language plpgsql set search_path = public as $$
begin
  if not public.is_personal_org_space(new.space_id) then
    raise exception 'space_members is only for personal-org spaces';
  end if;
  return new;
end;
$$;
create trigger space_members_personal_org_guard
  before insert on public.space_members
  for each row execute function public.guard_space_member_org();
```

- [ ] **Step 2: 로컬+원격 적용** — `supabase migration up --local` && `supabase db push`.

- [ ] **Step 3: 실패하는 테스트 작성** — Append to `packages/core/src/__tests__/org.test.ts` (팀 조직 `orgId`, `owner`; 개인 스페이스는 owner의 개인 조직):

```ts
describe("per-space 공유 개인 조직 제한", () => {
  let teamSpace: string;
  beforeAll(async () => {
    const { data: s } = await owner.client.from("spaces").insert({ user_id: owner.id, name: "팀 초대 차단", org_id: orgId }).select().single();
    teamSpace = s!.id;
  });
  it("팀 조직 스페이스에는 per-space 초대를 할 수 없다", async () => {
    const { error } = await owner.client.rpc("invite_to_space", { p_space_id: teamSpace, p_email: "x-team@test.local", p_role: "viewer" });
    expect(error).not.toBeNull();
  });
  it("개인 조직 스페이스에는 per-space 초대가 된다(회귀)", async () => {
    const { data: ps } = await owner.client.from("spaces").insert({ user_id: owner.id, name: "개인 초대 OK" }).select().single(); // org_id 생략 → 개인 조직
    const { error } = await owner.client.rpc("invite_to_space", { p_space_id: ps!.id, p_email: "x-personal@test.local", p_role: "viewer" });
    expect(error).toBeNull();
    await admin.from("space_invitations").delete().eq("space_id", ps!.id);
  });
  it("팀 조직 스페이스에 space_members 직접 insert는 트리거가 거부한다", async () => {
    const { error } = await admin.from("space_members").insert({ space_id: teamSpace, user_id: adminMember.id, role: "viewer" });
    expect(error).not.toBeNull();
  });
});
```

> 주의: 마지막 테스트는 `admin`(service_role) insert도 트리거가 막는지 확인. 트리거는 RLS와 달리 service_role에도 적용되므로 거부돼야 한다. (기존 share-space.test.ts는 개인 스페이스에 admin으로 space_members를 seed하는데, 그 스페이스들은 개인 조직이라 가드를 통과함 — 회귀 없음.)

- [ ] **Step 4: 테스트 실행 — 신규 + 회귀** — `pnpm --filter @tablign/core test org.test.ts share-space.test.ts`
Expected: 둘 다 PASS. **share-space.test.ts 회귀가 핵심** — 그 테스트의 스페이스들은 org_id 없이 생성돼 개인 조직에 속하므로 space_members seed·invite가 계속 통과해야 한다. 만약 깨지면 트리거가 개인 스페이스까지 막는 것 → 마이그레이션 재확인.

- [ ] **Step 5: 커밋**
```bash
git add supabase/migrations/0021_perspace_personal_only.sql packages/core/src/__tests__/org.test.ts
git commit -m "[기능] per-space 공유 개인 조직 제한 가드"
```

---

### Task 2: 팀 조직 스페이스에서 per-space 멤버 진입점 숨김 + 최종 회귀

**Files:**
- Modify: `apps/extension/src/newtab/NewTab.tsx`
- Modify: `apps/extension/src/newtab/NewTab.test.tsx`

**Interfaces:**
- Consumes: `activeSpaceOrg`(NewTab에 이미 계산됨, line ~760), `isOwner`(line ~747).

- [ ] **Step 1: 공간 "멤버" 버튼을 개인 조직 스페이스로 제한**

Modify `apps/extension/src/newtab/NewTab.tsx`:
- The space per-space "멤버" button currently renders when `{isOwner && (...)}` (around line 879). Change the condition to also require the active space's org to be personal:
```tsx
{isOwner && activeSpaceOrg?.is_personal && (
  <Button variant="outline" onClick={openMemberDialog}><Users size={15} /> 멤버</Button>
)}
```
- Rationale: for team-org spaces, per-space invite is server-blocked (Task 1); hiding the button avoids offering an action that would fail. Org membership is managed via the OrgHeader ⚙️ instead.
- Leave the space invitation-notification popover ("초대" received-invites) as-is — receiving a personal-space invite is still valid; this only hides the per-space INVITE-others entry point on team spaces.

- [ ] **Step 2: 빌드 + 테스트**
- `pnpm --filter @tablign/extension build` → clean.
- `pnpm --filter @tablign/extension test NewTab.test.tsx` → green. If a test asserted the space "멤버" button shows for an owner whose active space is now a team-org mock, adjust the mock/space to a personal org (`is_personal: true` org + space `org_id` = that org) so the existing assertion holds, OR update the assertion to reflect the personal-org gate. Keep assertions meaningful.

- [ ] **Step 3: 최종 전체 회귀 (Phase 4 close-out)**
- `pnpm test` (repo root) → ALL pass. Report totals.

- [ ] **Step 4: 커밋**
```bash
git add apps/extension/src/newtab/NewTab.tsx apps/extension/src/newtab/NewTab.test.tsx
git commit -m "[기능] 팀 조직 스페이스 per-space 초대 진입점 숨김"
```

---

## Self-Review

**Spec coverage (스펙 §4 per-space 가드, §8 4단계):**
- invite_to_space 개인 조직 가드(초크포인트) → Task 1 Step 1
- space_members insert 트리거(방어적 이중화) → Task 1 Step 1
- 팀 조직 스페이스 UI 진입점 숨김(1차 방어선) → Task 2

**Placeholder scan:** 구체 SQL·TSX 포함. Task 1은 0012의 현재 invite_to_space 본문을 "그대로 복사 후 가드 한 줄 추가"로 지시(본문 verbatim은 실행자가 0012에서 확인).

**회귀 안전성(핵심):** 기존 개인 스페이스는 백필로 개인 조직 소속 → `is_personal_org_space` true → 가드 통과. share-space.test.ts의 모든 스페이스가 org_id 없이 생성돼 개인 조직에 속하므로 space_members seed·invite가 계속 동작. Task 1 Step 4에서 명시적으로 회귀 확인.

**주의:** 트리거는 service_role에도 적용되므로, 향후 팀 조직 스페이스에 대한 어떤 space_members 시드도 막힌다(의도). 개인 스페이스 시드는 통과.
