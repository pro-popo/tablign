# 조직 기반(Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 조직(organization)을 스페이스의 상위 소속 단위로 도입한다 — 모든 스페이스가 조직에 소속되고, 유저는 개인 조직 + 팀 조직을 사이드바 레일로 전환한다. (멤버 초대·컬렉션 비공개는 후속 Phase.)

**Architecture:** 신규 테이블 `organizations` / `organization_members` / `organization_invitations` + `spaces.org_id`. 접근 판정은 기존처럼 RLS에 위임하고, security-definer 헬퍼(`has_org_access` 등)로 조직 멤버십을 본다. 기존 스페이스 insert 코드를 깨지 않도록 `org_id`가 null이면 개인 조직으로 채우는 BEFORE INSERT 트리거를 둔다. UI는 확장 레일(hover 시 이름 노출)로 조직을 전환한다.

**Tech Stack:** Supabase(Postgres + RLS), TypeScript, `@tablign/core`(데이터 계층), React(익스텐션 새 탭), Vitest.

## Global Constraints

- 커밋 컨벤션: `[타입] 명사형` (예: `[기능] 조직 레일`). `feat(scope):` 금지.
- 마이그레이션은 `supabase/migrations/NNNN_*.sql` 순번으로 추가. 최신 번호는 `0013`이므로 `0014`부터.
- RLS 판정은 기존 `security definer stable set search_path = public` 헬퍼 패턴을 따른다.
- 오너는 멤버 테이블에 넣지 않는다 — `organizations.owner_id`가 단일 진실 공급원.
- `spaces_select` 등 INSERT RETURNING 경로의 select 정책은 security-definer 함수 대신 **인라인 SQL** 을 쓴다(0011의 주석 참고 — 함수는 삽입 중인 행을 못 봄).
- 테스트는 원격 Supabase(`packages/core/.env.test`)에 붙는 기존 `rls.test.ts` / `share-space.test.ts` 패턴을 따른다. 새 마이그레이션은 실행 전 `supabase db push` 필요.
- 시안: 확정된 목업 = 좌측 확장 레일(resting 54px / hover 196px), 상단 tablign 로고, 개인=앰버 그라데이션 집 아이콘, 하단 계정. 역할칩 색: 소유자 `#fff4e6`/`#e8590c`, 관리자 `#edf0fe`/`#3b5bdb`, 멤버 `#f1f3f5`/`#868e96`.
- 테두리가 있는 레이아웃 요소엔 `boxSizing: "border-box"`를 명시(시안 좌표 어긋남 방지).

---

### Task 1: 조직 테이블 + 헬퍼 + 조직 테이블 RLS

**Files:**
- Create: `supabase/migrations/0014_organizations.sql`
- Test: `packages/core/src/__tests__/org.test.ts`

**Interfaces:**
- Produces (SQL RPC, `security definer stable`):
  - `has_org_access(p_org_id uuid) returns boolean`
  - `can_edit_org(p_org_id uuid) returns boolean`
  - `is_org_owner(p_org_id uuid) returns boolean`
  - `is_personal_org_space(p_space_id uuid) returns boolean`
- Produces (tables): `organizations`, `organization_members`, `organization_invitations` (컬럼은 아래 SQL 참고).

- [ ] **Step 1: 마이그레이션 작성 — 테이블·인덱스**

Create `supabase/migrations/0014_organizations.sql`:

```sql
-- 조직 1단계: 테이블 + 판정 헬퍼 + 조직 테이블 RLS

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  icon        text,
  color       text,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  is_personal boolean not null default false,
  created_at  timestamptz not null default now()
);
create index organizations_owner_id_idx on public.organizations(owner_id);
create unique index organizations_personal_uniq
  on public.organizations(owner_id) where is_personal;

create table public.organization_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin', 'member')),
  position   double precision not null default 1000,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index organization_members_user_id_idx on public.organization_members(user_id);

create table public.organization_invitations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  inviter_id    uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  role          text not null check (role in ('admin', 'member')),
  status        text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at    timestamptz not null default now()
);
create index organization_invitations_org_id_idx on public.organization_invitations(org_id);
create index organization_invitations_email_idx on public.organization_invitations(invitee_email);
create unique index organization_invitations_pending_uniq
  on public.organization_invitations(org_id, invitee_email) where status = 'pending';
```

- [ ] **Step 2: 마이그레이션 작성 — 헬퍼 함수**

Append to `0014_organizations.sql`:

```sql
create function public.has_org_access(p_org_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from organizations where id = p_org_id and owner_id = auth.uid())
        or exists (select 1 from organization_members where org_id = p_org_id and user_id = auth.uid());
$$;

create function public.can_edit_org(p_org_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from organizations where id = p_org_id and owner_id = auth.uid())
        or exists (select 1 from organization_members where org_id = p_org_id and user_id = auth.uid() and role = 'admin');
$$;

create function public.is_org_owner(p_org_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from organizations where id = p_org_id and owner_id = auth.uid());
$$;

-- 스페이스가 개인 조직에 속하는가 (per-space 공유 가드·후속 Phase에서 재사용)
create function public.is_personal_org_space(p_space_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from spaces s join organizations o on o.id = s.org_id
      where s.id = p_space_id and o.is_personal
    );
$$;
```

- [ ] **Step 3: 마이그레이션 작성 — 조직 테이블 RLS + 트리거 + grants + realtime**

Append to `0014_organizations.sql`:

```sql
-- role 셀프 승격 방지 (space_members 패턴)
create function public.guard_org_member_role_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.org_id <> old.org_id then raise exception 'org_id cannot be changed'; end if;
  if new.role <> old.role and not public.is_org_owner(old.org_id) then
    raise exception 'only the owner can change member role';
  end if;
  return new;
end;
$$;
create trigger organization_members_role_guard
  before update on public.organization_members
  for each row execute function public.guard_org_member_role_update();

alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.organization_invitations enable row level security;

-- organizations: select=접근자(INSERT RETURNING 위해 인라인), insert=본인 소유·팀 조직만,
--                update=owner·admin, delete=owner이며 개인 조직 아님
create policy "organizations_select" on public.organizations
  for select using (
    owner_id = auth.uid()
    or exists (select 1 from organization_members m where m.org_id = organizations.id and m.user_id = auth.uid())
  );
create policy "organizations_insert" on public.organizations
  for insert with check (owner_id = auth.uid() and is_personal = false);
create policy "organizations_update" on public.organizations
  for update using (public.can_edit_org(id)) with check (public.can_edit_org(id));
create policy "organizations_delete" on public.organizations
  for delete using (public.is_org_owner(id) and not is_personal);

-- organization_members: select=같은 조직 접근자, insert 정책 없음(수락 RPC는 Phase 2),
--                       update=본인(position)·owner(role), delete=owner 또는 본인(나가기)
create policy "organization_members_select" on public.organization_members
  for select using (public.has_org_access(org_id));
create policy "organization_members_update" on public.organization_members
  for update using (public.is_org_owner(org_id) or user_id = auth.uid())
  with check (public.is_org_owner(org_id) or user_id = auth.uid());
create policy "organization_members_delete" on public.organization_members
  for delete using (public.is_org_owner(org_id) or user_id = auth.uid());

-- organization_invitations: select=owner·admin 또는 초대받은 본인, delete=owner·admin
create policy "organization_invitations_select" on public.organization_invitations
  for select using (
    public.can_edit_org(org_id)
    or lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
create policy "organization_invitations_delete" on public.organization_invitations
  for delete using (public.can_edit_org(org_id));

alter publication supabase_realtime add table public.organizations;
alter publication supabase_realtime add table public.organization_members;
alter publication supabase_realtime add table public.organization_invitations;

-- authenticated 실행 권한 (0005 패턴)
grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.organization_invitations to authenticated;
grant execute on function public.has_org_access(uuid) to authenticated;
grant execute on function public.can_edit_org(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.is_personal_org_space(uuid) to authenticated;

-- service_role seeding (테스트)
grant select, insert, update, delete on public.organizations to service_role;
grant select, insert, update, delete on public.organization_members to service_role;
grant select, insert, update, delete on public.organization_invitations to service_role;
```

- [ ] **Step 4: 마이그레이션 적용**

Run: `cd /Users/jeongjin-a/Desktop/project/tablign && supabase db push`
Expected: `0014_organizations.sql` 적용 성공 (에러 없음).

- [ ] **Step 5: 실패하는 테스트 작성 — 조직 테이블 접근 매트릭스**

Create `packages/core/src/__tests__/org.test.ts` (헬퍼는 `share-space.test.ts`의 `makeUser`/`admin` 패턴 복제):

```ts
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
```

- [ ] **Step 6: 테스트 실패 확인**

Run: `cd /Users/jeongjin-a/Desktop/project/tablign && pnpm --filter @tablign/core test org.test.ts`
Expected: 파일이 없거나(첫 실행) 이미 작성 후라면 PASS — Step 4에서 마이그레이션을 적용했으므로 PASS해야 정상. 만약 FAIL이면 마이그레이션 오류 → 메시지로 원인 파악.

> 이 태스크는 마이그레이션(구현)을 먼저 적용한 뒤 테스트를 붙이는 순서다(스키마는 TDD의 "구현"에 해당). 테스트가 바로 PASS하면 스키마가 스펙대로다.

- [ ] **Step 7: 커밋**

```bash
git add supabase/migrations/0014_organizations.sql packages/core/src/__tests__/org.test.ts
git commit -m "[기능] 조직 테이블·RLS·판정 헬퍼"
```

---

### Task 2: spaces.org_id + 개인 조직 백필 + 기본 org 트리거 + 신규 가입 트리거

**Files:**
- Create: `supabase/migrations/0015_spaces_org.sql`
- Modify: `packages/core/src/__tests__/org.test.ts` (백필·트리거 테스트 추가)

**Interfaces:**
- Consumes: `organizations` 테이블(Task 1).
- Produces: `spaces.org_id uuid not null`, `set_default_space_org()` 트리거(org_id null이면 개인 조직으로 채움), 확장된 `handle_new_user()`.

- [ ] **Step 1: 마이그레이션 작성 — 컬럼·백필·트리거**

Create `supabase/migrations/0015_spaces_org.sql`:

```sql
-- spaces.org_id 추가 → 개인 조직 백필 → not null 승격

alter table public.spaces add column org_id uuid references public.organizations(id) on delete cascade;

-- 1) 모든 profiles에 개인 조직 생성(없으면)
insert into public.organizations (name, owner_id, is_personal)
select '개인', p.id, true from public.profiles p
where not exists (
  select 1 from public.organizations o where o.owner_id = p.id and o.is_personal
);

-- 2) 기존 스페이스를 소유자의 개인 조직에 소속
update public.spaces s
set org_id = o.id
from public.organizations o
where o.owner_id = s.user_id and o.is_personal and s.org_id is null;

-- 3) not null 승격
alter table public.spaces alter column org_id set not null;
create index spaces_org_id_idx on public.spaces(org_id);

-- 4) org_id 미지정 insert는 소유자의 개인 조직으로 자동 채움
--    (기존 createSpace 호출부·테스트가 org_id 없이 insert해도 동작하게)
create function public.set_default_space_org() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is null then
    select id into new.org_id from organizations where owner_id = new.user_id and is_personal;
  end if;
  return new;
end;
$$;
create trigger spaces_default_org
  before insert on public.spaces
  for each row execute function public.set_default_space_org();

-- 5) 신규 가입 시 profiles와 함께 개인 조직도 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  insert into public.organizations (name, owner_id, is_personal)
  values ('개인', new.id, true);
  return new;
end;
$$;
```

- [ ] **Step 2: 마이그레이션 적용**

Run: `supabase db push`
Expected: `0015_spaces_org.sql` 적용 성공. (기존 스페이스가 있으면 org_id가 모두 채워진 뒤 not null 승격됨.)

- [ ] **Step 3: 실패하는 테스트 작성 — 백필·트리거·자동 org**

Append to `packages/core/src/__tests__/org.test.ts`:

```ts
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
```

- [ ] **Step 4: 테스트 실행**

Run: `pnpm --filter @tablign/core test org.test.ts`
Expected: PASS (신규 유저 개인 조직 1개, 자동/명시 org_id 모두 동작).

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0015_spaces_org.sql packages/core/src/__tests__/org.test.ts
git commit -m "[기능] 스페이스 org_id·개인 조직 백필"
```

---

### Task 3: 스페이스·컬렉션 RLS를 조직 멤버십 기준으로 재작성

**Files:**
- Create: `supabase/migrations/0016_org_space_rls.sql`
- Modify: `packages/core/src/__tests__/org.test.ts`

**Interfaces:**
- Consumes: `has_org_access` / `can_edit_org`(Task 1), `spaces.org_id`(Task 2).
- Produces: 재작성된 `has_space_access` / `can_edit_space`(조직 멤버십 + 개인 조직 per-space 공유 both), 갱신된 `spaces`/`collections` 정책.

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/0016_org_space_rls.sql`:

```sql
-- 스페이스 접근·편집 판정을 조직 멤버십 기반으로 확장.
-- 기존 per-space 공유(space_members)는 개인 조직 스페이스에 대해서만 행이 존재하므로 그대로 유지.

create or replace function public.has_space_access(p_space_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from spaces s where s.id = p_space_id and public.has_org_access(s.org_id)
    )
    or exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid());
$$;

create or replace function public.can_edit_space(p_space_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from spaces s where s.id = p_space_id and public.can_edit_org(s.org_id)
    )
    or exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid() and role = 'editor');
$$;

-- spaces select: 인라인(INSERT RETURNING). 오너 본인 or per-space 멤버 or 조직 접근자.
drop policy "spaces_select" on public.spaces;
create policy "spaces_select" on public.spaces
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.space_members where space_id = spaces.id and user_id = auth.uid())
    or public.has_org_access(spaces.org_id)
  );

-- spaces write: 조직 편집권(owner/admin). insert는 본인 명의 + 대상 조직 편집권.
drop policy "spaces_insert" on public.spaces;
drop policy "spaces_update" on public.spaces;
drop policy "spaces_delete" on public.spaces;
create policy "spaces_insert" on public.spaces
  for insert with check (auth.uid() = user_id and public.can_edit_org(org_id));
create policy "spaces_update" on public.spaces
  for update using (public.can_edit_org(org_id)) with check (public.can_edit_org(org_id));
create policy "spaces_delete" on public.spaces
  for delete using (public.can_edit_org(org_id));
```

> `collections`/`links` 정책은 0011에서 이미 `has_space_access`/`can_edit_space`에 위임하므로, 위 함수 재작성만으로 조직 멤버십이 자동 반영된다. 정책 재작성 불필요.

- [ ] **Step 2: 마이그레이션 적용**

Run: `supabase db push`
Expected: `0016_org_space_rls.sql` 적용 성공.

- [ ] **Step 3: 실패하는 테스트 작성 — 조직 스페이스 접근 매트릭스**

Append to `packages/core/src/__tests__/org.test.ts`:

```ts
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
```

- [ ] **Step 4: 테스트 실행 — 신규 + 기존 회귀**

Run: `pnpm --filter @tablign/core test org.test.ts share-space.test.ts`
Expected: 둘 다 PASS. (`share-space.test.ts`는 org_id 없이 스페이스를 insert하지만 Task 2 트리거가 개인 조직으로 채우므로 그대로 통과해야 한다 — 회귀 확인이 핵심.)

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0016_org_space_rls.sql packages/core/src/__tests__/org.test.ts
git commit -m "[기능] 스페이스 RLS 조직 멤버십 확장"
```

---

### Task 4: core 타입 + 조직 데이터 계층

**Files:**
- Modify: `packages/core/src/types.ts`
- Create: `packages/core/src/data/organizations.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/data/spaces.ts:4-9` (`CreateSpaceInput`에 `org_id` 추가)
- Modify: `packages/core/src/__tests__/org.test.ts`

**Interfaces:**
- Produces (TS):
  - `interface Organization { id: string; name: string; icon: string | null; color: string | null; owner_id: string; is_personal: boolean; created_at: string }`
  - `interface OrganizationMember { org_id: string; user_id: string; role: "admin" | "member"; position: number; created_at: string }`
  - `interface OrganizationInvitation { id: string; org_id: string; inviter_id: string; invitee_email: string; role: "admin" | "member"; status: "pending" | "accepted" | "declined"; created_at: string }`
  - `listOrganizations(client): Promise<Organization[]>`
  - `createOrganization(client, input: { name: string; owner_id: string; icon?: string | null; color?: string | null }): Promise<Organization>`
  - `updateOrganization(client, id: string, patch: Partial<Pick<Organization, "name" | "icon" | "color">>): Promise<Organization>`
  - `deleteOrganization(client, id: string): Promise<void>`
  - `listMyOrgMemberships(client): Promise<OrganizationMember[]>`

- [ ] **Step 1: 타입 추가**

Append to `packages/core/src/types.ts`:

```ts
export interface Organization {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  owner_id: string;
  is_personal: boolean;
  created_at: string;
}

export interface OrganizationMember {
  org_id: string;
  user_id: string;
  role: "admin" | "member";
  position: number;
  created_at: string;
}

export interface OrganizationInvitation {
  id: string;
  org_id: string;
  inviter_id: string;
  invitee_email: string;
  role: "admin" | "member";
  status: "pending" | "accepted" | "declined";
  created_at: string;
}
```

Then add `org_id: string;` to the `Space` interface (after `user_id: string;`).

- [ ] **Step 2: spaces.ts에 org_id 입력 추가**

Modify `packages/core/src/data/spaces.ts` `CreateSpaceInput`:

```ts
export interface CreateSpaceInput {
  user_id: string;
  name: string;
  icon?: string | null;
  position?: number;
  org_id?: string;
}
```

(insert는 `input`을 그대로 넘기므로 `org_id`가 있으면 반영, 없으면 트리거가 개인 조직으로 채운다.)

- [ ] **Step 3: 데이터 계층 작성**

Create `packages/core/src/data/organizations.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Organization, OrganizationMember } from "../types";

/** 내가 접근 가능한 모든 조직(개인 + 팀). RLS가 필터. */
export async function listOrganizations(client: SupabaseClient): Promise<Organization[]> {
  const { data, error } = await client.from("organizations").select().order("created_at", { ascending: true });
  if (error) throw error;
  return data as Organization[];
}

export async function createOrganization(
  client: SupabaseClient,
  input: { name: string; owner_id: string; icon?: string | null; color?: string | null },
): Promise<Organization> {
  const { data, error } = await client.from("organizations").insert(input).select().single();
  if (error) throw error;
  return data as Organization;
}

export async function updateOrganization(
  client: SupabaseClient,
  id: string,
  patch: Partial<Pick<Organization, "name" | "icon" | "color">>,
): Promise<Organization> {
  const { data, error } = await client.from("organizations").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Organization;
}

export async function deleteOrganization(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("organizations").delete().eq("id", id);
  if (error) throw error;
}

/** 내가 admin/member로 속한 조직 멤버십 — 역할 판정·레일 순서용. */
export async function listMyOrgMemberships(client: SupabaseClient): Promise<OrganizationMember[]> {
  const { data, error } = await client
    .from("organization_members")
    .select("org_id, user_id, role, position, created_at")
    .order("position", { ascending: true });
  if (error) throw error;
  return data as OrganizationMember[];
}
```

- [ ] **Step 4: export 추가**

Modify `packages/core/src/index.ts` — add:

```ts
export * from "./data/organizations";
```

(타입은 기존 `export * from "./types"` 로 이미 노출된다고 가정. 아니라면 `types` re-export 라인 확인 후 동일 패턴으로 추가.)

- [ ] **Step 5: 실패하는 테스트 작성 — 데이터 계층**

Append to `packages/core/src/__tests__/org.test.ts` (상단 import에 추가):

```ts
import { listOrganizations, createOrganization, updateOrganization, listMyOrgMemberships } from "../data/organizations";
```

```ts
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
```

- [ ] **Step 6: 테스트 실행**

Run: `pnpm --filter @tablign/core test org.test.ts`
Expected: PASS.

- [ ] **Step 7: 타입체크 + 커밋**

Run: `pnpm --filter @tablign/core build` (또는 레포 타입체크 명령)
Expected: 타입 에러 없음.

```bash
git add packages/core/src/types.ts packages/core/src/data/organizations.ts packages/core/src/data/spaces.ts packages/core/src/index.ts packages/core/src/__tests__/org.test.ts
git commit -m "[기능] 조직 타입·데이터 계층"
```

---

### Task 5: 활성 조직 상태 훅

**Files:**
- Create: `apps/extension/src/lib/useActiveOrg.ts`

**Interfaces:**
- Produces: `useActiveOrg(): { activeOrgId: string | null; setActiveOrgId: (id: string | null) => void; loaded: boolean }`

- [ ] **Step 1: 훅 작성 (useActiveSpace 패턴 복제)**

Create `apps/extension/src/lib/useActiveOrg.ts`:

```ts
import { useEffect, useState } from "react";

const KEY = "tablign.activeOrg";

// 활성 조직 id를 chrome.storage.local에 영속화한다(useActiveSpace와 동일 패턴).
export function useActiveOrg() {
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(KEY, (res) => {
      const v = res[KEY];
      if (typeof v === "string") setActiveOrgIdState(v);
      setLoaded(true);
    });
  }, []);

  function setActiveOrgId(id: string | null) {
    setActiveOrgIdState(id);
    chrome.storage.local.set({ [KEY]: id });
  }

  return { activeOrgId, setActiveOrgId, loaded };
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `pnpm --filter @tablign/extension build` (또는 tsc)
Expected: 에러 없음.

```bash
git add apps/extension/src/lib/useActiveOrg.ts
git commit -m "[기능] 활성 조직 상태 훅"
```

---

### Task 6: 조직 레일 컴포넌트

**Files:**
- Create: `apps/extension/src/newtab/OrgRail.tsx`
- Reference: 확정 시안(확장 레일) — 이 파일 Global Constraints의 색·치수.

**Interfaces:**
- Consumes: `Organization`, `OrganizationMember`(`@tablign/core`); `LogoMark`(`@tablign/ui`).
- Produces:
```ts
export interface OrgRailProps {
  organizations: Organization[];      // 개인 조직 포함 전체
  memberships: OrganizationMember[];  // 팀 조직 순서·역할용
  activeOrgId: string | null;
  userEmail: string;
  currentUserId: string;
  onSelectOrg: (id: string) => void;
  onCreateOrg: () => void;
}
export function OrgRail(props: OrgRailProps): JSX.Element;
```

- [ ] **Step 1: 컴포넌트 작성**

Create `apps/extension/src/newtab/OrgRail.tsx`. resting 54px / hover 196px 확장, 개인=앰버 집 아이콘, 상단 로고, 하단 계정. 테두리 요소엔 `boxSizing: "border-box"`.

```tsx
import { useState } from "react";
import type { Organization, OrganizationMember } from "@tablign/core";
import { LogoMark, Home, Plus, theme } from "@tablign/ui";

export interface OrgRailProps {
  organizations: Organization[];
  memberships: OrganizationMember[];
  activeOrgId: string | null;
  userEmail: string;
  currentUserId: string;
  onSelectOrg: (id: string) => void;
  onCreateOrg: () => void;
}

const RAIL_REST = 54;
const RAIL_HOVER = 196;
const TEAM_COLORS = ["#20a97e", "#e8590c", "#7048e8", "#1098ad", "#e64980"];

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export function OrgRail({ organizations, memberships, activeOrgId, userEmail, currentUserId, onSelectOrg, onCreateOrg }: OrgRailProps) {
  const [expanded, setExpanded] = useState(false);
  const personal = organizations.find((o) => o.is_personal) ?? null;
  const teams = organizations.filter((o) => !o.is_personal);

  const box = (bg: string): React.CSSProperties => ({
    width: 32, height: 32, borderRadius: 9, flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontSize: 12, fontWeight: 700, background: bg, boxSizing: "border-box",
  });
  const row = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 12, height: 40, padding: "0 11px", cursor: "pointer",
    position: "relative", boxSizing: "border-box",
  });
  const label = (active: boolean): React.CSSProperties => ({
    opacity: expanded ? 1 : 0, transition: "opacity .13s ease", whiteSpace: "nowrap",
    fontSize: 12.5, color: active ? theme.accent : "#495057", fontWeight: active ? 600 : 400,
  });
  const activeBar: React.CSSProperties = {
    content: '""', position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
    width: 4, height: 22, borderRadius: "0 3px 3px 0", background: theme.accent,
  };

  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        position: "absolute", left: 0, top: 0, bottom: 0, zIndex: 3,
        width: expanded ? RAIL_HOVER : RAIL_REST, transition: "width .18s ease, box-shadow .18s",
        background: "#f5f6f8", borderRight: `1px solid ${theme.border}`,
        boxShadow: expanded ? "8px 0 26px rgba(0,0,0,.13)" : "none",
        padding: "10px 0", display: "flex", flexDirection: "column", gap: 5,
        overflow: "hidden", boxSizing: "border-box",
      }}
    >
      {/* 로고 */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, height: 34, padding: "0 12px", marginBottom: 2 }}>
        <LogoMark size={26} />
        <span style={{ opacity: expanded ? 1 : 0, transition: "opacity .13s", fontWeight: 740, letterSpacing: "-0.03em", fontSize: 16, color: theme.text, whiteSpace: "nowrap" }}>
          tab<span style={{ color: theme.accent }}>lign</span>
        </span>
      </div>
      <div style={{ height: 1, background: "#e2e5ea", margin: "2px 12px 4px" }} />

      {/* 개인 조직 */}
      {personal && (() => {
        const active = personal.id === activeOrgId;
        return (
          <div style={row(active)} onClick={() => onSelectOrg(personal.id)}>
            {active && <span style={activeBar} />}
            <span style={box("linear-gradient(135deg,#ffd43b,#f59f00)")}><Home size={16} /></span>
            <span style={label(active)}>개인</span>
          </div>
        );
      })()}

      {/* 팀 조직 (멤버십 position 순, personal은 위) */}
      {teams.map((o, i) => {
        const active = o.id === activeOrgId;
        return (
          <div key={o.id} style={row(active)} onClick={() => onSelectOrg(o.id)}>
            {active && <span style={activeBar} />}
            <span style={box(o.color ?? TEAM_COLORS[i % TEAM_COLORS.length])}>{o.icon ?? initials(o.name)}</span>
            <span style={label(active)}>{o.name}</span>
          </div>
        );
      })}

      {/* 조직 만들기 */}
      <div style={row(false)} onClick={onCreateOrg}>
        <span style={{ ...box("#fff"), border: `1px dashed ${theme.textFaint}`, color: theme.textFaint }}><Plus size={15} /></span>
        <span style={{ ...label(false), color: theme.textFaint }}>조직 만들기</span>
      </div>

      <div style={{ flex: 1 }} />
      <div style={{ height: 1, background: "#e2e5ea", margin: "0 12px 4px" }} />
      {/* 계정 */}
      <div style={row(false)} title={userEmail}>
        <span style={{ width: 32, height: 32, borderRadius: "50%", background: "#dfe2ea", flex: "none", border: "2px solid #fff", boxShadow: "0 0 0 1px #e2e5ea", boxSizing: "border-box" }} />
        <span style={{ ...label(false), overflow: "hidden", textOverflow: "ellipsis" }}>{userEmail}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 아이콘 export 확인**

Verify `Home` is exported from `@tablign/ui`. If not, add `Home` to the lucide re-export list in `packages/ui/src/icons.ts` (alongside `Plus`, `Hash`, …) and rebuild `@tablign/ui`.

Run: `grep -n "Home" packages/ui/src/icons.ts`
Expected: `Home` 존재. 없으면 추가.

- [ ] **Step 3: 타입체크**

Run: `pnpm --filter @tablign/extension build`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add apps/extension/src/newtab/OrgRail.tsx packages/ui/src/icons.ts
git commit -m "[기능] 조직 레일 컴포넌트"
```

---

### Task 7: NewTab 배선 — 조직 로드·전환·스페이스 필터

**Files:**
- Modify: `apps/extension/src/newtab/NewTab.tsx`

**Interfaces:**
- Consumes: `listOrganizations`, `createOrganization`, `listMyOrgMemberships`, `useActiveOrg`, `OrgRail`.

- [ ] **Step 1: import·상태 추가**

Modify `apps/extension/src/newtab/NewTab.tsx`:

1) `@tablign/core` import에 추가: `listOrganizations, createOrganization, listMyOrgMemberships, type Organization, type OrganizationMember`.
2) 상단 import에 추가:
```ts
import { useActiveOrg } from "../lib/useActiveOrg";
import { OrgRail } from "./OrgRail";
```
3) `NewTab()` 상태 추가(기존 `spaces` state 근처):
```ts
const [organizations, setOrganizations] = useState<Organization[]>([]);
const [orgMemberships, setOrgMemberships] = useState<OrganizationMember[]>([]);
const { activeOrgId, setActiveOrgId, loaded: orgLoaded } = useActiveOrg();
```

- [ ] **Step 2: 조직 로드 effect 추가**

Add after the session effect (near line 143):

```ts
// 조직 로드: 활성 조직을 chrome.storage에서 읽은 뒤 실행. 저장값이 없으면 개인 조직으로 폴백.
useEffect(() => {
  if (!session || !orgLoaded) return;
  (async () => {
    const [orgs, oms] = await Promise.all([listOrganizations(supabase), listMyOrgMemberships(supabase)]);
    setOrganizations(orgs);
    setOrgMemberships(oms);
    const keep = activeOrgId && orgs.some((o) => o.id === activeOrgId);
    const personal = orgs.find((o) => o.is_personal);
    setActiveOrgId(keep ? activeOrgId : (personal?.id ?? orgs[0]?.id ?? null));
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [session, orgLoaded]);
```

- [ ] **Step 3: 스페이스 목록을 활성 조직으로 필터**

`listSpaces`는 모든 접근 가능 스페이스를 돌려주므로, 렌더 직전에 활성 조직으로 필터한다. `ownedSpaces`/`sharedSpaces` 계산부(현재 660-661행)를 교체:

```ts
const orgSpaces = spaces.filter((s) => s.org_id === activeOrgId);
const ownedSpaces = orgSpaces.filter((s) => !memberships.some((m) => m.space_id === s.id));
const sharedSpaces = orgSpaces.filter((s) => memberships.some((m) => m.space_id === s.id));
```

그리고 스페이스 로드 effect(148-159행)의 활성 스페이스 폴백을 조직 스페이스 기준으로 바꾼다:

```ts
const first = sp.find((s) => s.org_id === (activeOrgId ?? "")) ?? sp[0];
const keep = activeSpaceId && sp.some((s) => s.id === activeSpaceId);
setActiveSpaceId(keep ? activeSpaceId : (first?.id ?? null));
```

- [ ] **Step 4: 조직 전환·생성 핸들러 + activeOrg 변경 시 활성 스페이스 보정**

Add handlers inside `NewTab()`:

```ts
function selectOrg(id: string) {
  setActiveOrgId(id);
  const firstInOrg = spaces.find((s) => s.org_id === id) ?? null;
  setActiveSpaceId(firstInOrg?.id ?? null);
}

async function createOrg() {
  if (!session) return;
  const org = await createOrganization(supabase, { name: "새 조직", owner_id: session.user.id });
  setOrganizations((prev) => [...prev, org]);
  setActiveOrgId(org.id);
  setActiveSpaceId(null);
}
```

`addSpace`가 활성 조직에 스페이스를 만들도록 `org_id` 전달(216-223행 `createSpace` 호출):

```ts
const s = await createSpace(supabase, { user_id: session.user.id, name, org_id: activeOrgId ?? undefined });
```

- [ ] **Step 5: 레일을 AppShell 좌측에 배치**

`AppShell`의 `left`에 들어가는 `ExtSidebar`를 레일 + 사이드바 조합으로 감싼다. `left` prop 교체:

```tsx
left={
  <div style={{ position: "relative", height: "100%", paddingLeft: 54, boxSizing: "border-box" }}>
    <OrgRail
      organizations={organizations}
      memberships={orgMemberships}
      activeOrgId={activeOrgId}
      userEmail={session.user.email ?? ""}
      currentUserId={session.user.id}
      onSelectOrg={selectOrg}
      onCreateOrg={createOrg}
    />
    <ExtSidebar
      spaces={ownedSpaces}
      sharedSpaces={sharedSpaces}
      activeSpaceId={activeSpaceId}
      userEmail={session.user.email ?? ""}
      onSelectSpace={(id) => { setActiveSpaceId(id); }}
      onAddSpace={addSpace}
      onRenameSpace={renameSpace}
      onDeleteSpace={deleteSpace}
      onLeaveSpace={handleLeaveSpace}
      onSignOut={async () => { await supabase.auth.signOut(); }}
      onCollapse={toggleLeft}
      onImportCode={() => setImportOpen(true)}
      searchSlot={<ExtSearchBar />}
    />
  </div>
}
```

(레일은 `position:absolute`로 54px 폭을 차지하고 hover 시 사이드바 위로 확장된다. 사이드바는 `paddingLeft:54`로 레일 자리를 비운다.)

- [ ] **Step 6: 앱 실행해 확인**

Run: `pnpm --filter @tablign/extension build` then load the unpacked extension (or `/run` skill).
Expected 동작:
- 새 탭 왼쪽에 좁은 레일 + tablign 로고, 개인(앰버 집) 아이콘이 보인다.
- 레일에 hover하면 196px로 확장되며 "개인"·계정 이메일이 나타난다.
- "조직 만들기" 클릭 → 새 조직이 생기고 레일에 아이콘 추가, SPACES가 비어 스페이스 추가 가능.
- 개인 ↔ 새 조직 전환 시 SPACES 목록이 해당 조직 것으로 바뀐다.

- [ ] **Step 7: 커밋**

```bash
git add apps/extension/src/newtab/NewTab.tsx
git commit -m "[기능] 새 탭 조직 로드·전환 배선"
```

---

### Task 8: NewTab 회귀 테스트 갱신

**Files:**
- Modify: `apps/extension/src/newtab/NewTab.test.tsx`

- [ ] **Step 1: 기존 테스트 실행해 깨진 지점 확인**

Run: `pnpm --filter @tablign/extension test NewTab.test.tsx`
Expected: 조직 관련 mock 부재로 실패할 수 있음(예: `listOrganizations` 미모킹). 실패 메시지 확인.

- [ ] **Step 2: mock 보강**

`NewTab.test.tsx`의 `@tablign/core` mock에 조직 함수를 추가한다. 기존 mock 블록에 아래를 더한다(반환값은 개인 조직 하나로 최소 구성):

```ts
listOrganizations: vi.fn().mockResolvedValue([
  { id: "org-personal", name: "개인", icon: null, color: null, owner_id: "u1", is_personal: true, created_at: "" },
]),
listMyOrgMemberships: vi.fn().mockResolvedValue([]),
createOrganization: vi.fn(),
```

그리고 mock `listSpaces` 반환 스페이스 객체에 `org_id: "org-personal"` 필드를 추가해 필터를 통과시킨다.

`chrome.storage.local.get` mock이 `tablign.activeOrg`에도 응답하도록(기존 activeSpace mock과 동일 방식) 보강한다.

- [ ] **Step 3: 테스트 통과 확인**

Run: `pnpm --filter @tablign/extension test NewTab.test.tsx`
Expected: PASS.

- [ ] **Step 4: 전체 테스트 스위트 회귀**

Run: `cd /Users/jeongjin-a/Desktop/project/tablign && pnpm test`
Expected: 전체 PASS (core RLS·share-space·org, extension NewTab·OpenTabsPanel·Auth 등).

- [ ] **Step 5: 커밋**

```bash
git add apps/extension/src/newtab/NewTab.test.tsx
git commit -m "[테스트] 조직 도입 후 새 탭 회귀 갱신"
```

---

## Self-Review

**Spec coverage (spec §별 매핑):**
- §1 핵심 구조(모든 스페이스=조직 소속, 개인=기본 조직) → Task 2(백필·트리거)
- §2 데이터 모델(테이블 3 + org_id) → Task 1, 2, 4
- §3 권한(owner/admin 편집, member 읽기) → Task 3(RLS) + 테스트
- §4 RLS 헬퍼·재작성 → Task 1, 3
- §5 마이그레이션/백필 → Task 2
- §6 UI(레일·전환) → Task 5, 6, 7
- §8 구현단계 1 → 본 계획서 전체
- **의도적으로 이 계획서에서 제외(후속 Phase, spec §7 단계표와 일치):** 컬렉션 비공개(`is_private`, Phase 3), 조직 이메일 초대 RPC·멤버 관리 UI·역할칩 헤더(Phase 2), per-space 공유 가드(`invite_to_space` 수정·space_members 트리거, Phase 4). → 각각 별도 계획서.

**Placeholder scan:** "TBD/TODO/적절히" 없음. 모든 SQL·TS·TSX는 실제 코드. Task 8 Step 2는 기존 mock 구조에 의존하므로 "기존 mock 블록에 추가"로 명시(파일을 못 봤으나 추가할 정확한 항목·필드는 구체화).

**Type consistency:** `Organization`/`OrganizationMember` 필드가 Task 1 SQL 컬럼과 Task 4 TS 인터페이스에서 일치(`is_personal`, `owner_id`, `role: 'admin'|'member'`). `OrgRailProps`가 Task 6 정의와 Task 7 사용처에서 일치. `createOrganization` 시그니처(`{name, owner_id, ...}`)가 Task 4 정의와 Task 7 호출에서 일치. `CreateSpaceInput.org_id?`가 Task 4와 Task 7 `addSpace` 호출에서 일치.

**남은 위험(실행 시 확인):**
- RLS `WITH CHECK`가 BEFORE 트리거(`set_default_space_org`)로 채워진 `org_id`를 보는지 — Task 2 Step 3 "org_id 없이 insert" 테스트가 이를 검증(실패 시 데이터 계층에서 org_id 명시 전달로 전환).
- `share-space.test.ts` 회귀 — Task 3 Step 4에서 명시적으로 함께 실행.
