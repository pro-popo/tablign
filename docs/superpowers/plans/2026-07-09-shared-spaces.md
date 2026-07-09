# 공유 스페이스 협업 구현 계획 (공유 3단계)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스페이스에 이메일로 멤버를 초대하고(오너/편집자/뷰어), 멤버가 실시간으로 함께 컬렉션·링크를 편집하는 공유 스페이스 협업을 구현한다.

**Architecture:** `space_members`·`space_invitations` 테이블을 추가하고, RLS 판정을 `security definer` 헬퍼 함수(has_space_access 등)로 모아 기존 `for all` 정책을 select(접근)/write(편집) 분리로 개편한다. 정책이 `space_members`를 참조해도 헬퍼가 definer라 RLS 재귀가 끊긴다. 초대 수락·멤버 편집은 원자성이 필요한 것만 RPC로, 나머지는 RLS 위임 일반 쿼리로 처리한다. Realtime은 RLS를 따르므로 멤버 간 실시간 동기화·초대 알림이 기존 구독으로 자동 동작한다.

**Tech Stack:** Supabase(PostgreSQL RLS/RPC/Realtime), TypeScript, React, vitest + @testing-library/react, pnpm workspace

**설계 문서:** `docs/superpowers/specs/2026-07-03-sharing-design.md` (4·5-3·6절)

## Global Constraints

- Node >= 20, pnpm 10.15.0 / 새 외부 의존성 금지 / UI 문구·주석 한국어
- 오너는 `space_members`에 넣지 않는다 — `spaces.user_id`가 오너의 단일 진실 공급원, 멤버 테이블엔 editor/viewer만
- 역할 값: `role in ('editor', 'viewer')`. 권한 매트릭스는 스펙 3절을 그대로 따른다
- 이메일은 저장·비교 모두 `lower()` 정규화
- 헬퍼·RPC는 `security definer set search_path = public`. 뮤테이션 RPC는 execute를 authenticated에만(public/anon revoke)
- 태그는 개인 소유 유지 — `collection_tags`는 태그 소유자 기준, 공유 스페이스에서 복사 시 태그 미복사
- 사이드바 정렬 이원화: 개인 = `spaces.position`, 공유됨 = 내 `space_members.position` (기존 `packages/core/src/position.ts` 재사용)
- viewer는 편집 진입점을 UI에서 숨긴다 (RLS가 최종 방어선, UI는 1차)
- 통합 테스트는 로컬 Supabase(`npx supabase start`) + `packages/core/.env.test`. 마이그레이션 적용은 `npx supabase db reset`. 멤버십 시드는 service-role `admin` 클라이언트로 직접 insert(RLS 우회)
- 기존 테스트(`rls.test.ts`, `data.test.ts`, `copy-collection.test.ts`, `share.test.ts`)가 그대로 통과해야 함 — RLS 개편의 회귀 안전망
- 커밋 관례: fe-toolkit 팀 컨벤션 `[타입] 내용` (기능/수정/개선 등, 한국어 명사형, 50자 이내), 본문은 제목으로 부족할 때만

---

### Task 1: 멤버십·초대 테이블 + 헬퍼 함수 + 새 테이블 RLS (마이그레이션 0010)

**Files:**
- Create: `supabase/migrations/0010_space_members.sql`
- Test: `packages/core/src/__tests__/share-space.test.ts` (새 파일)

**Interfaces:**
- Produces:
  - 테이블 `space_members(space_id, user_id, role, position, created_at, pk(space_id,user_id))`, `space_invitations(id, space_id, inviter_id, invitee_email, role, status, created_at)`
  - 헬퍼(전부 `returns boolean`, `security definer stable`): `has_space_access(p_space_id uuid)`, `can_edit_space(p_space_id uuid)`, `is_space_owner(p_space_id uuid)`, `has_collection_access(p_collection_id uuid)`, `can_edit_collection(p_collection_id uuid)`, `shares_space_with(p_other uuid)`
  - 트리거 `space_members_role_guard` (role 변경은 오너만)
  - 두 새 테이블의 RLS 정책, realtime publication 등록

- [ ] **Step 1: 실패하는 통합 테스트 작성**

`packages/core/src/__tests__/share-space.test.ts` 생성. `rls.test.ts`의 env 파서·`makeUser`를 복사하고, service-role `admin` 클라이언트도 노출한다(멤버십 시드용).

```typescript
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
  await admin.from("space_members").insert([
    { space_id: spaceId, user_id: editor.id, role: "editor" },
    { space_id: spaceId, user_id: viewer.id, role: "viewer" },
  ]);
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
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

로컬 Supabase 실행 중이어야 한다(`npx supabase status`, 꺼져 있으면 `npx supabase start`).

Run: `pnpm --filter @tablign/core test -- share-space`
Expected: FAIL — `space_members` 테이블/`has_space_access` 함수 없음

- [ ] **Step 3: 마이그레이션 작성**

`supabase/migrations/0010_space_members.sql` 생성:

```sql
-- 공유 스페이스 3단계: 멤버십·초대 테이블 + RLS 판정 헬퍼 + 새 테이블 정책

-- 1) 스페이스 멤버십 (오너는 넣지 않음 — spaces.user_id가 오너의 단일 진실 공급원)
create table public.space_members (
  space_id   uuid not null references public.spaces(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('editor', 'viewer')),
  position   double precision not null default 1000,  -- 내 사이드바 "공유됨" 섹션 순서
  created_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index space_members_user_id_idx on public.space_members(user_id);

-- 2) 스페이스 초대
create table public.space_invitations (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces(id) on delete cascade,
  inviter_id    uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,             -- lower() 정규화 저장
  role          text not null check (role in ('editor', 'viewer')),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at    timestamptz not null default now()
);
create index space_invitations_space_id_idx on public.space_invitations(space_id);
create index space_invitations_email_idx on public.space_invitations(invitee_email);
-- 같은 스페이스에 같은 이메일 pending 초대 중복 차단
create unique index space_invitations_pending_uniq
  on public.space_invitations(space_id, invitee_email) where status = 'pending';

-- 3) RLS 판정 헬퍼 (security definer라 정책 내부에서 space_members를 읽어도 RLS 재귀가 끊긴다)
create function public.has_space_access(p_space_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from spaces where id = p_space_id and user_id = auth.uid())
        or exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid());
$$;

create function public.can_edit_space(p_space_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from spaces where id = p_space_id and user_id = auth.uid())
        or exists (select 1 from space_members where space_id = p_space_id and user_id = auth.uid() and role = 'editor');
$$;

create function public.is_space_owner(p_space_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (select 1 from spaces where id = p_space_id and user_id = auth.uid());
$$;

create function public.has_collection_access(p_collection_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from collections c where c.id = p_collection_id and public.has_space_access(c.space_id)
    );
$$;

create function public.can_edit_collection(p_collection_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from collections c where c.id = p_collection_id and public.can_edit_space(c.space_id)
    );
$$;

-- 두 사용자가 공유하는 스페이스가 있는가 (profiles 상호 열람용)
create function public.shares_space_with(p_other uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    with mine as (
      select id as sid from spaces where user_id = auth.uid()
      union select space_id from space_members where user_id = auth.uid()
    ), theirs as (
      select id as sid from spaces where user_id = p_other
      union select space_id from space_members where user_id = p_other
    )
    select exists (select 1 from mine m join theirs t on m.sid = t.sid);
$$;

-- 4) role 셀프 승격 방지: update로 role을 바꾸는 건 오너만 (position 변경은 허용)
create function public.guard_member_role_update() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.role <> old.role and not public.is_space_owner(new.space_id) then
    raise exception 'only the owner can change member role';
  end if;
  return new;
end;
$$;
create trigger space_members_role_guard
  before update on public.space_members
  for each row execute function public.guard_member_role_update();

-- 5) 새 테이블 RLS
alter table public.space_members enable row level security;
alter table public.space_invitations enable row level security;

-- space_members: select=같은 스페이스 접근자, insert 정책 없음(수락 RPC 경유),
--                update=본인(position)·오너(role), delete=오너 또는 본인(나가기)
create policy "space_members_select" on public.space_members
  for select using (public.has_space_access(space_id));
create policy "space_members_update" on public.space_members
  for update using (public.is_space_owner(space_id) or user_id = auth.uid())
  with check (public.is_space_owner(space_id) or user_id = auth.uid());
create policy "space_members_delete" on public.space_members
  for delete using (public.is_space_owner(space_id) or user_id = auth.uid());

-- space_invitations: select=오너 또는 초대받은 본인(이메일 매칭), delete=오너
--                    insert/수락/거절은 RPC(security definer) 경유 → 정책 없음
create policy "space_invitations_select" on public.space_invitations
  for select using (
    public.is_space_owner(space_id)
    or lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
create policy "space_invitations_delete" on public.space_invitations
  for delete using (public.is_space_owner(space_id));

-- 6) Realtime (RLS를 따르므로 멤버·초대 변경이 자동 전파)
alter publication supabase_realtime add table public.space_members;
alter publication supabase_realtime add table public.space_invitations;
```

- [ ] **Step 4: 마이그레이션 적용 후 테스트 통과 확인**

Run: `npx supabase db reset` (루트에서, 0001~0010 재적용)
Run: `pnpm --filter @tablign/core test -- share-space`
Expected: PASS

기존 테스트 회귀 확인:
Run: `pnpm --filter @tablign/core test`
Expected: 전부 PASS (기존 정책은 아직 안 건드렸으므로 그대로 통과)

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0010_space_members.sql packages/core/src/__tests__/share-space.test.ts
git commit -m "[기능] 멤버십·초대 테이블 및 RLS 헬퍼"
```

---

### Task 2: 기존 테이블 RLS 개편 (마이그레이션 0011)

**Files:**
- Create: `supabase/migrations/0011_shared_rls.sql`
- Test: `packages/core/src/__tests__/share-space.test.ts` (describe 블록 추가)

**Interfaces:**
- Consumes: Task 1의 헬퍼 함수 6개, 시드된 `owner/editor/viewer/outsider` + `spaceId`
- Produces: `spaces`/`collections`/`links`/`collection_tags`/`profiles`의 멤버십 기반 정책 (기존 `*_all_own` 정책 대체)

- [ ] **Step 1: 실패하는 테스트 추가**

`share-space.test.ts` 끝에 추가. 컬렉션·링크 픽스처를 owner로 만들어 둔다.

```typescript
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
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @tablign/core test -- share-space`
Expected: FAIL — 기존 `collections_all_own`(user_id 기준)이라 editor가 owner의 컬렉션을 못 봄/못 고침

- [ ] **Step 3: 마이그레이션 작성**

`supabase/migrations/0011_shared_rls.sql` 생성:

```sql
-- 기존 개인 전용 정책을 멤버십 기반으로 개편 (select=접근, write=편집 분리)

-- spaces: 접근자는 보고, 쓰기(생성/수정/삭제)는 오너만
drop policy "spaces_all_own" on public.spaces;
create policy "spaces_select" on public.spaces
  for select using (public.has_space_access(id));
create policy "spaces_insert" on public.spaces
  for insert with check (auth.uid() = user_id);
create policy "spaces_update" on public.spaces
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "spaces_delete" on public.spaces
  for delete using (auth.uid() = user_id);

-- collections: 접근자는 보고, editor 이상은 편집. insert는 본인 명의로만.
drop policy "collections_all_own" on public.collections;
create policy "collections_select" on public.collections
  for select using (public.has_space_access(space_id));
create policy "collections_insert" on public.collections
  for insert with check (public.can_edit_space(space_id) and auth.uid() = user_id);
create policy "collections_update" on public.collections
  for update using (public.can_edit_space(space_id)) with check (public.can_edit_space(space_id));
create policy "collections_delete" on public.collections
  for delete using (public.can_edit_space(space_id));

-- links: 소속 컬렉션의 스페이스 기준
drop policy "links_all_own" on public.links;
create policy "links_select" on public.links
  for select using (public.has_collection_access(collection_id));
create policy "links_insert" on public.links
  for insert with check (public.can_edit_collection(collection_id) and auth.uid() = user_id);
create policy "links_update" on public.links
  for update using (public.can_edit_collection(collection_id)) with check (public.can_edit_collection(collection_id));
create policy "links_delete" on public.links
  for delete using (public.can_edit_collection(collection_id));

-- collection_tags: 태그는 끝까지 개인 소유 — 태그 소유자 기준으로 변경
drop policy "collection_tags_all_own" on public.collection_tags;
create policy "collection_tags_all_own" on public.collection_tags
  for all using (
    exists (select 1 from public.tags t where t.id = collection_tags.tag_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.tags t where t.id = collection_tags.tag_id and t.user_id = auth.uid())
  );

-- profiles: 본인 + 같은 스페이스를 공유하는 멤버끼리 열람 가능
drop policy "profiles_select_own" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.uid() = id or public.shares_space_with(id));
-- profiles_update_own(본인만 수정)은 그대로 유지
```

- [ ] **Step 4: 적용 후 전체 테스트 통과 확인**

Run: `npx supabase db reset`
Run: `pnpm --filter @tablign/core test`
Expected: 전부 PASS — 특히 기존 `rls.test.ts`·`data.test.ts`(오너 단독 CRUD 회귀)와 신규 매트릭스

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0011_shared_rls.sql packages/core/src/__tests__/share-space.test.ts
git commit -m "[개선] 스페이스 RLS를 멤버십 기반으로 개편"
```

---

### Task 3: 초대 RPC + 2단계 RPC 헬퍼 기반 교체 (마이그레이션 0012)

**Files:**
- Create: `supabase/migrations/0012_share_space_rpc.sql`
- Test: `packages/core/src/__tests__/share-space.test.ts` (describe 블록 추가)

**Interfaces:**
- Consumes: Task 1 헬퍼, Task 2 정책, 기존 `copy_collection_rows`
- Produces:
  - `invite_to_space(p_space_id uuid, p_email text, p_role text) returns uuid` — 초대 id
  - `accept_invitation(p_invitation_id uuid) returns void`
  - `decline_invitation(p_invitation_id uuid) returns void`
  - `copy_collection`/`move_collection`/`create_collection_share_code`/`import_collection_by_code`의 소유권 검사를 헬퍼 기반으로 `create or replace`

- [ ] **Step 1: 실패하는 테스트 추가**

`share-space.test.ts` 끝에 추가:

```typescript
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
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @tablign/core test -- share-space`
Expected: FAIL — `invite_to_space` 함수 없음, 그리고 editor의 copy/share가 기존 `s.user_id = v_uid` 검사에 막힘

- [ ] **Step 3: 마이그레이션 작성**

`supabase/migrations/0012_share_space_rpc.sql` 생성:

```sql
-- 초대 RPC + 2단계 RPC를 멤버십 헬퍼 기반으로 교체

-- 초대 생성: 오너만, 자기 자신·기존 멤버·중복 pending 차단, 이메일 소문자 정규화
create function public.invite_to_space(p_space_id uuid, p_email text, p_role text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_invitee uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_role not in ('editor', 'viewer') then raise exception 'invalid role'; end if;
  if not public.is_space_owner(p_space_id) then raise exception 'only the owner can invite'; end if;
  if v_email = lower(coalesce(auth.jwt() ->> 'email', '')) then raise exception 'cannot invite yourself'; end if;

  -- 이미 멤버인 이메일인지(가입된 사용자 한정) 확인
  select id into v_invitee from auth.users where lower(email) = v_email;
  if v_invitee is not null and exists (
    select 1 from space_members where space_id = p_space_id and user_id = v_invitee
  ) then
    raise exception 'already a member';
  end if;

  insert into space_invitations (space_id, inviter_id, invitee_email, role)
  values (p_space_id, v_uid, v_email, p_role)
  returning id into v_id;   -- 중복 pending은 부분 유니크 인덱스가 unique_violation으로 차단
  return v_id;
end;
$$;
revoke execute on function public.invite_to_space(uuid, text, text) from public, anon;
grant execute on function public.invite_to_space(uuid, text, text) to authenticated;

-- 초대 수락: 호출자 이메일 = 초대 이메일 검증 → 멤버 insert + status 갱신 (멱등)
create function public.accept_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_inv record;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_inv from space_invitations where id = p_invitation_id;
  if v_inv is null or lower(v_inv.invitee_email) <> v_email then
    raise exception 'invitation not found';
  end if;
  if v_inv.status = 'declined' then raise exception 'invitation already declined'; end if;

  insert into space_members (space_id, user_id, role)
  values (v_inv.space_id, v_uid, v_inv.role)
  on conflict (space_id, user_id) do nothing;  -- 멱등
  update space_invitations set status = 'accepted' where id = p_invitation_id;
end;
$$;
revoke execute on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- 초대 거절
create function public.decline_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_inv record;
begin
  select * into v_inv from space_invitations where id = p_invitation_id;
  if v_inv is null or lower(v_inv.invitee_email) <> v_email then
    raise exception 'invitation not found';
  end if;
  update space_invitations set status = 'declined' where id = p_invitation_id;
end;
$$;
revoke execute on function public.decline_invitation(uuid) from public, anon;
grant execute on function public.decline_invitation(uuid) to authenticated;

-- ── 2단계 RPC 헬퍼 기반 교체 (editor도 공유 스페이스에서 사용 가능) ──

create or replace function public.copy_collection(p_collection_id uuid, p_target_space_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not public.has_collection_access(p_collection_id) then raise exception 'source collection not found or not accessible'; end if;
  if not public.can_edit_space(p_target_space_id) then raise exception 'target space not found or not editable'; end if;
  return copy_collection_rows(p_collection_id, p_target_space_id, v_uid);
end;
$$;

create or replace function public.move_collection(p_collection_id uuid, p_target_space_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not public.can_edit_collection(p_collection_id) then raise exception 'source collection not found or not editable'; end if;
  if not public.can_edit_space(p_target_space_id) then raise exception 'target space not found or not editable'; end if;
  update collections
  set space_id = p_target_space_id,
      position = (select coalesce(max(position), 0) + 1000 from collections where space_id = p_target_space_id)
  where id = p_collection_id;
end;
$$;

create or replace function public.create_collection_share_code(p_collection_id uuid, p_expires_in_days int default 7)
returns table(code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code text;
  v_expires timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not public.can_edit_collection(p_collection_id) then raise exception 'collection not found or not accessible'; end if;
  perform pg_advisory_xact_lock(hashtext(p_collection_id::text));
  return query
    select s.code, s.expires_at from collection_share_codes s
    where s.collection_id = p_collection_id and s.revoked_at is null
      and (s.expires_at is null or s.expires_at > now());
  if found then return; end if;
  v_expires := case when p_expires_in_days is null then null else now() + make_interval(days => p_expires_in_days) end;
  for attempt in 1..20 loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    begin
      insert into collection_share_codes(code, collection_id, created_by, expires_at)
      values (v_code, p_collection_id, v_uid, v_expires);
      return query select v_code, v_expires;
      return;
    exception when unique_violation then
    end;
  end loop;
  raise exception 'failed to generate share code';
end;
$$;

create or replace function public.import_collection_by_code(p_code text, p_target_space_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_collection_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select s.collection_id into v_collection_id from collection_share_codes s
  where s.code = p_code and s.revoked_at is null and (s.expires_at is null or s.expires_at > now());
  if v_collection_id is null then raise exception 'share code not found or expired'; end if;
  if not public.can_edit_space(p_target_space_id) then raise exception 'target space not found or not editable'; end if;
  return copy_collection_rows(v_collection_id, p_target_space_id, v_uid);
end;
$$;
```

- [ ] **Step 4: 적용 후 전체 테스트 통과 확인**

Run: `npx supabase db reset`
Run: `pnpm --filter @tablign/core test`
Expected: 전부 PASS — 특히 기존 `copy-collection.test.ts`·`share.test.ts`(오너 단독 회귀)와 신규 초대/확장 테스트

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0012_share_space_rpc.sql packages/core/src/__tests__/share-space.test.ts
git commit -m "[기능] 초대 RPC 및 공유 코드·복사 RPC 멤버십 확장"
```

---

### Task 4: core 데이터 계층 (멤버·초대 함수)

**Files:**
- Modify: `packages/core/src/types.ts` (타입 3개 추가)
- Create: `packages/core/src/data/members.ts`
- Create: `packages/core/src/data/invitations.ts`
- Modify: `packages/core/src/index.ts` (export 2줄 추가)
- Test: `packages/core/src/__tests__/share-space.test.ts` (describe 블록 추가)

**Interfaces:**
- Consumes: Task 1~3의 테이블·RPC
- Produces (`@tablign/core`에서 export):
  ```typescript
  // types.ts
  export interface SpaceMember { space_id: string; user_id: string; role: "editor" | "viewer"; position: number; created_at: string }
  export interface MemberWithProfile extends SpaceMember { display_name: string | null; avatar_url: string | null }
  export interface SpaceInvitation { id: string; space_id: string; inviter_id: string; invitee_email: string; role: "editor" | "viewer"; status: "pending" | "accepted" | "declined"; created_at: string }
  export interface InvitationWithSpace extends SpaceInvitation { space_name: string; inviter_name: string | null }

  // data/members.ts
  listMembers(client, spaceId): Promise<MemberWithProfile[]>   // profiles join, position 오름차순
  removeMember(client, spaceId, userId): Promise<void>
  updateMemberRole(client, spaceId, userId, role): Promise<void>
  updateMemberPosition(client, spaceId, userId, position): Promise<void>
  leaveSpace(client, spaceId, userId): Promise<void>
  listMyMemberships(client): Promise<SpaceMember[]>            // 내가 멤버인 스페이스(공유됨 섹션용)

  // data/invitations.ts
  inviteToSpace(client, spaceId, email, role): Promise<string>
  listSpaceInvitations(client, spaceId): Promise<SpaceInvitation[]>   // 오너: 대기 중 초대 목록
  listMyInvitations(client): Promise<InvitationWithSpace[]>           // 나에게 온 pending 초대
  acceptInvitation(client, invitationId): Promise<void>
  declineInvitation(client, invitationId): Promise<void>
  cancelInvitation(client, invitationId): Promise<void>              // 오너가 pending 초대 취소(delete)
  ```

- [ ] **Step 1: 실패하는 테스트 추가**

`share-space.test.ts` 끝에 추가 (상단 import에 `import { listMembers, updateMemberRole, inviteToSpace, listMyInvitations, acceptInvitation, listMyMemberships } from "../data/members"` 및 `../data/invitations` — 아래 구현 위치에 맞게 분리 import):

```typescript
import {
  listMembers, removeMember, updateMemberRole, updateMemberPosition, leaveSpace, listMyMemberships,
} from "../data/members";
import {
  inviteToSpace, listSpaceInvitations, listMyInvitations, acceptInvitation, declineInvitation, cancelInvitation,
} from "../data/invitations";

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
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @tablign/core test -- share-space`
Expected: FAIL — `../data/members` 모듈 없음

- [ ] **Step 3: 구현**

`packages/core/src/types.ts` 끝에 위 Interfaces의 타입 4개 추가.

`packages/core/src/data/members.ts` 생성:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpaceMember, MemberWithProfile } from "../types";

/** 스페이스 멤버 목록(프로필 join, position 오름차순). editor/viewer만 — 오너는 포함되지 않는다. */
export async function listMembers(client: SupabaseClient, spaceId: string): Promise<MemberWithProfile[]> {
  const { data, error } = await client
    .from("space_members")
    .select("space_id, user_id, role, position, created_at, profiles(display_name, avatar_url)")
    .eq("space_id", spaceId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data as unknown[]).map((row) => {
    const r = row as SpaceMember & { profiles: { display_name: string | null; avatar_url: string | null } | null };
    return { ...r, display_name: r.profiles?.display_name ?? null, avatar_url: r.profiles?.avatar_url ?? null };
  });
}

/** 멤버 제거(오너) 또는 본인 강제 제거. */
export async function removeMember(client: SupabaseClient, spaceId: string, userId: string): Promise<void> {
  const { error } = await client.from("space_members").delete().eq("space_id", spaceId).eq("user_id", userId);
  if (error) throw error;
}

/** 멤버 역할 변경(오너만 — role 가드 트리거가 강제). */
export async function updateMemberRole(client: SupabaseClient, spaceId: string, userId: string, role: "editor" | "viewer"): Promise<void> {
  const { error } = await client.from("space_members").update({ role }).eq("space_id", spaceId).eq("user_id", userId);
  if (error) throw error;
}

/** 내 사이드바 "공유됨" 섹션에서의 순서 변경(본인 행). */
export async function updateMemberPosition(client: SupabaseClient, spaceId: string, userId: string, position: number): Promise<void> {
  const { error } = await client.from("space_members").update({ position }).eq("space_id", spaceId).eq("user_id", userId);
  if (error) throw error;
}

/** 스페이스에서 나가기(본인 행 삭제). */
export async function leaveSpace(client: SupabaseClient, spaceId: string, userId: string): Promise<void> {
  const { error } = await client.from("space_members").delete().eq("space_id", spaceId).eq("user_id", userId);
  if (error) throw error;
}

/** 내가 멤버(editor/viewer)로 속한 스페이스 목록 — 사이드바 "공유됨" 섹션용. */
export async function listMyMemberships(client: SupabaseClient): Promise<SpaceMember[]> {
  const { data, error } = await client
    .from("space_members")
    .select("space_id, user_id, role, position, created_at")
    .order("position", { ascending: true });
  if (error) throw error;
  return data as SpaceMember[];
}
```

`packages/core/src/data/invitations.ts` 생성:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpaceInvitation, InvitationWithSpace } from "../types";

/** 이메일로 스페이스에 초대(오너). 초대 id 반환. */
export async function inviteToSpace(client: SupabaseClient, spaceId: string, email: string, role: "editor" | "viewer"): Promise<string> {
  const { data, error } = await client.rpc("invite_to_space", { p_space_id: spaceId, p_email: email, p_role: role });
  if (error) throw error;
  return data as string;
}

/** 스페이스의 대기 중(pending) 초대 목록(오너 — 멤버 관리 다이얼로그용). */
export async function listSpaceInvitations(client: SupabaseClient, spaceId: string): Promise<SpaceInvitation[]> {
  const { data, error } = await client
    .from("space_invitations").select().eq("space_id", spaceId).eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as SpaceInvitation[];
}

/** 나에게 온 pending 초대 목록(스페이스 이름·초대자 이름 포함) — 알림 배지용. */
export async function listMyInvitations(client: SupabaseClient): Promise<InvitationWithSpace[]> {
  const { data, error } = await client
    .from("space_invitations")
    .select("id, space_id, inviter_id, invitee_email, role, status, created_at, spaces(name), profiles!space_invitations_inviter_id_fkey(display_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown[]).map((row) => {
    const r = row as SpaceInvitation & { spaces: { name: string } | null; profiles: { display_name: string | null } | null };
    return { ...r, space_name: r.spaces?.name ?? "", inviter_name: r.profiles?.display_name ?? null };
  });
}

export async function acceptInvitation(client: SupabaseClient, invitationId: string): Promise<void> {
  const { error } = await client.rpc("accept_invitation", { p_invitation_id: invitationId });
  if (error) throw error;
}

export async function declineInvitation(client: SupabaseClient, invitationId: string): Promise<void> {
  const { error } = await client.rpc("decline_invitation", { p_invitation_id: invitationId });
  if (error) throw error;
}

/** 오너가 대기 중 초대를 취소(delete). */
export async function cancelInvitation(client: SupabaseClient, invitationId: string): Promise<void> {
  const { error } = await client.from("space_invitations").delete().eq("id", invitationId);
  if (error) throw error;
}
```

`packages/core/src/index.ts`에 추가:

```typescript
export * from "./data/members";
export * from "./data/invitations";
```

주의: `listMyInvitations`의 select에서 초대자 프로필 join은 FK 이름(`space_invitations_inviter_id_fkey`)으로 명시적 관계 지정이 필요하다. 구현 후 실제 FK 이름이 다르면 `npx supabase db reset` 후 `\d space_invitations`로 확인하거나, join 실패 시 `inviter_id`로 별도 조회하는 방식으로 대체한다. (테스트에서 `space_name`은 필수, `inviter_name`은 null 허용이므로 join이 어려우면 inviter_name은 별도 쿼리 없이 null로 두어도 테스트 통과.)

- [ ] **Step 4: 테스트·린트 통과 확인**

Run: `pnpm --filter @tablign/core test && pnpm --filter @tablign/core lint`
Expected: 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/types.ts packages/core/src/data/members.ts packages/core/src/data/invitations.ts packages/core/src/index.ts packages/core/src/__tests__/share-space.test.ts
git commit -m "[기능] 멤버·초대 데이터 계층 함수"
```

---

### Task 5: UI 컴포넌트 (멤버 다이얼로그 · 초대 목록 · 아바타 스택)

**Files:**
- Create: `packages/ui/src/MemberDialog.tsx`
- Create: `packages/ui/src/InvitationList.tsx`
- Create: `packages/ui/src/MemberAvatars.tsx`
- Modify: `packages/ui/src/index.ts` (export 3줄)
- Modify: `packages/ui/src/icons.ts` (`Users`, `Check`, `X`는 이미 없으면 추가 — `Users` 추가, `X`는 존재 확인)
- Test: `packages/ui/src/__tests__/MemberDialog.test.tsx`, `packages/ui/src/__tests__/InvitationList.test.tsx`

**Interfaces:**
- Consumes: 없음(순수 프레젠테이션 — 데이터·핸들러는 props로 주입, `MemberWithProfile`/`InvitationWithSpace` 형태를 인라인 타입으로 받음)
- Produces:
  ```typescript
  export interface MemberRow { user_id: string; role: "editor" | "viewer"; display_name: string | null; avatar_url: string | null }
  export interface InviteRow { id: string; invitee_email: string; role: "editor" | "viewer" }
  export interface MemberDialogProps {
    open: boolean;
    spaceName: string;
    members: MemberRow[];
    pendingInvites: InviteRow[];
    onInvite: (email: string, role: "editor" | "viewer") => void;
    onChangeRole: (userId: string, role: "editor" | "viewer") => void;
    onRemove: (userId: string) => void;
    onCancelInvite: (id: string) => void;
    onClose: () => void;
  }
  export function MemberDialog(props: MemberDialogProps): JSX.Element | null

  export interface InvitationItem { id: string; space_name: string; inviter_name: string | null; role: "editor" | "viewer" }
  export interface InvitationListProps {
    invitations: InvitationItem[];
    onAccept: (id: string) => void;
    onDecline: (id: string) => void;
  }
  export function InvitationList(props: InvitationListProps): JSX.Element

  export interface AvatarPerson { display_name: string | null; avatar_url: string | null }
  export function MemberAvatars({ people, max }: { people: AvatarPerson[]; max?: number }): JSX.Element
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/ui/src/__tests__/MemberDialog.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemberDialog } from "../MemberDialog";

const members = [
  { user_id: "e1", role: "editor" as const, display_name: "에디터", avatar_url: null },
  { user_id: "v1", role: "viewer" as const, display_name: "뷰어", avatar_url: null },
];
function noop() {}

describe("MemberDialog", () => {
  it("멤버·대기 초대 목록을 보여준다", () => {
    render(<MemberDialog open spaceName="스터디" members={members} pendingInvites={[{ id: "i1", invitee_email: "p@x.com", role: "viewer" }]}
      onInvite={noop} onChangeRole={noop} onRemove={noop} onCancelInvite={noop} onClose={noop} />);
    expect(screen.getByText("에디터")).toBeInTheDocument();
    expect(screen.getByText("뷰어")).toBeInTheDocument();
    expect(screen.getByText("p@x.com")).toBeInTheDocument();
  });

  it("이메일 입력 후 초대하면 onInvite를 호출한다", () => {
    const onInvite = vi.fn();
    render(<MemberDialog open spaceName="스터디" members={[]} pendingInvites={[]}
      onInvite={onInvite} onChangeRole={noop} onRemove={noop} onCancelInvite={noop} onClose={noop} />);
    fireEvent.change(screen.getByPlaceholderText(/이메일/), { target: { value: "new@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: /초대/ }));
    expect(onInvite).toHaveBeenCalledWith("new@x.com", "editor");
  });

  it("멤버 제거 버튼이 onRemove를 호출한다", () => {
    const onRemove = vi.fn();
    render(<MemberDialog open spaceName="스터디" members={members} pendingInvites={[]}
      onInvite={noop} onChangeRole={noop} onRemove={onRemove} onCancelInvite={noop} onClose={noop} />);
    fireEvent.click(screen.getAllByRole("button", { name: "멤버 제거" })[0]);
    expect(onRemove).toHaveBeenCalledWith("e1");
  });

  it("open=false면 렌더하지 않는다", () => {
    const { container } = render(<MemberDialog open={false} spaceName="s" members={[]} pendingInvites={[]}
      onInvite={noop} onChangeRole={noop} onRemove={noop} onCancelInvite={noop} onClose={noop} />);
    expect(container.firstChild).toBeNull();
  });
});
```

`packages/ui/src/__tests__/InvitationList.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InvitationList } from "../InvitationList";

describe("InvitationList", () => {
  it("초대 항목과 수락/거절 버튼을 보여주고 콜백을 호출한다", () => {
    const onAccept = vi.fn(), onDecline = vi.fn();
    render(<InvitationList invitations={[{ id: "i1", space_name: "스터디", inviter_name: "앨리스", role: "viewer" }]}
      onAccept={onAccept} onDecline={onDecline} />);
    expect(screen.getByText(/스터디/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "수락" }));
    expect(onAccept).toHaveBeenCalledWith("i1");
    fireEvent.click(screen.getByRole("button", { name: "거절" }));
    expect(onDecline).toHaveBeenCalledWith("i1");
  });

  it("초대가 없으면 안내 문구를 보여준다", () => {
    render(<InvitationList invitations={[]} onAccept={() => {}} onDecline={() => {}} />);
    expect(screen.getByText(/받은 초대가 없어요/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @tablign/ui test`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`packages/ui/src/icons.ts` export 목록에 `Users`, `Check`를 추가(`X`는 이미 존재).

`packages/ui/src/MemberAvatars.tsx` 생성:

```tsx
import { theme } from "./theme";

export interface AvatarPerson { display_name: string | null; avatar_url: string | null }

/** 멤버 아바타를 겹쳐 보여주는 스택. 초과분은 +N으로 표시. */
export function MemberAvatars({ people, max = 4 }: { people: AvatarPerson[]; max?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {shown.map((p, i) => (
        <div key={i} title={p.display_name ?? undefined}
          style={{
            width: 24, height: 24, borderRadius: "50%", marginLeft: i === 0 ? 0 : -8,
            border: `2px solid ${theme.surface}`, background: p.avatar_url ? `center/cover url(${p.avatar_url})` : theme.surface2,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: theme.textMuted, boxSizing: "border-box",
          }}>
          {!p.avatar_url && (p.display_name?.[0] ?? "?")}
        </div>
      ))}
      {rest > 0 && (
        <div style={{ marginLeft: -8, width: 24, height: 24, borderRadius: "50%", border: `2px solid ${theme.surface}`, background: theme.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: theme.textMuted, boxSizing: "border-box" }}>
          +{rest}
        </div>
      )}
    </div>
  );
}
```

`packages/ui/src/MemberDialog.tsx` 생성 (오버레이 패턴 + 등장 애니메이션은 기존 `overlayAnimation` 재사용):

```tsx
import { useEffect, useState } from "react";
import { theme } from "./theme";
import { Button } from "./Button";
import { X } from "./icons";
import { overlayAnimationCss, overlayIn, panelIn } from "./overlayAnimation";

export interface MemberRow { user_id: string; role: "editor" | "viewer"; display_name: string | null; avatar_url: string | null }
export interface InviteRow { id: string; invitee_email: string; role: "editor" | "viewer" }
export interface MemberDialogProps {
  open: boolean;
  spaceName: string;
  members: MemberRow[];
  pendingInvites: InviteRow[];
  onInvite: (email: string, role: "editor" | "viewer") => void;
  onChangeRole: (userId: string, role: "editor" | "viewer") => void;
  onRemove: (userId: string) => void;
  onCancelInvite: (id: string) => void;
  onClose: () => void;
}

const ROLE_LABEL: Record<"editor" | "viewer", string> = { editor: "편집자", viewer: "뷰어" };

export function MemberDialog({ open, spaceName, members, pendingInvites, onInvite, onChangeRole, onRemove, onCancelInvite, onClose }: MemberDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  useEffect(() => { if (!open) { setEmail(""); setRole("editor"); } }, [open]);
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;

  function submitInvite() {
    const v = email.trim();
    if (!v) return;
    onInvite(v, role);
    setEmail("");
  }

  return (
    <div role="presentation" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", animation: overlayIn, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <style>{overlayAnimationCss}</style>
      <div role="dialog" aria-modal="true" aria-label="멤버 관리" onClick={(e) => e.stopPropagation()}
        style={{ width: 380, maxWidth: "calc(100vw - 32px)", animation: panelIn, background: theme.surface, borderRadius: 12, padding: "20px 20px 16px", boxShadow: "0 12px 40px rgba(0,0,0,.22)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>'{spaceName}' 멤버</div>

        {/* 초대 입력 */}
        <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="초대할 이메일"
            onKeyDown={(e) => { if (e.key === "Enter") submitInvite(); }}
            style={{ flex: 1, padding: "8px 10px", border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          <select value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
            aria-label="역할" style={{ border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, padding: "0 6px" }}>
            <option value="editor">편집자</option>
            <option value="viewer">뷰어</option>
          </select>
          <Button onClick={submitInvite}>초대</Button>
        </div>

        {/* 멤버 목록 */}
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          {members.map((m) => (
            <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: m.avatar_url ? `center/cover url(${m.avatar_url})` : theme.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: theme.textMuted, flexShrink: 0 }}>
                {!m.avatar_url && (m.display_name?.[0] ?? "?")}
              </div>
              <span style={{ flex: 1, fontSize: 13, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.display_name ?? "이름 없음"}</span>
              <select value={m.role} onChange={(e) => onChangeRole(m.user_id, e.target.value as "editor" | "viewer")}
                aria-label="멤버 역할" style={{ border: `1px solid ${theme.border}`, borderRadius: 7, fontSize: 12, padding: "2px 4px" }}>
                <option value="editor">편집자</option>
                <option value="viewer">뷰어</option>
              </select>
              <button type="button" title="멤버 제거" aria-label="멤버 제거" onClick={() => onRemove(m.user_id)}
                style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 3 }}>
                <X size={14} color={theme.textFaint} />
              </button>
            </div>
          ))}
          {pendingInvites.map((inv) => (
            <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.7 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: theme.surface2, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, color: theme.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.invitee_email}</span>
              <span style={{ fontSize: 11, color: theme.textFaint }}>{ROLE_LABEL[inv.role]} · 대기 중</span>
              <button type="button" title="초대 취소" aria-label="초대 취소" onClick={() => onCancelInvite(inv.id)}
                style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 3 }}>
                <X size={14} color={theme.textFaint} />
              </button>
            </div>
          ))}
          {members.length === 0 && pendingInvites.length === 0 && (
            <div style={{ fontSize: 12.5, color: theme.textFaint, padding: "6px 2px" }}>아직 멤버가 없어요. 이메일로 초대해보세요.</div>
          )}
        </div>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <Button variant="outline" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </div>
  );
}
```

`packages/ui/src/InvitationList.tsx` 생성:

```tsx
import { theme } from "./theme";
import { Button } from "./Button";

export interface InvitationItem { id: string; space_name: string; inviter_name: string | null; role: "editor" | "viewer" }
export interface InvitationListProps {
  invitations: InvitationItem[];
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

const ROLE_LABEL: Record<"editor" | "viewer", string> = { editor: "편집자", viewer: "뷰어" };

/** 받은 초대 목록. 헤더 알림 팝오버 안에 넣어 쓴다. */
export function InvitationList({ invitations, onAccept, onDecline }: InvitationListProps) {
  if (invitations.length === 0) {
    return <div style={{ padding: "14px 12px", fontSize: 12.5, color: theme.textFaint }}>받은 초대가 없어요.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8, maxWidth: 300 }}>
      {invitations.map((inv) => (
        <div key={inv.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 9, padding: "9px 11px" }}>
          <div style={{ fontSize: 13, color: theme.text }}>
            {inv.inviter_name ? `${inv.inviter_name}님이 ` : ""}<b>'{inv.space_name}'</b>에 초대했어요
          </div>
          <div style={{ fontSize: 11.5, color: theme.textFaint, marginTop: 2 }}>{ROLE_LABEL[inv.role]} 권한</div>
          <div style={{ marginTop: 8, display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <Button variant="outline" onClick={() => onDecline(inv.id)}>거절</Button>
            <Button onClick={() => onAccept(inv.id)}>수락</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

`packages/ui/src/index.ts`에 추가:

```typescript
export * from "./MemberAvatars";
export * from "./MemberDialog";
export * from "./InvitationList";
```

- [ ] **Step 4: 테스트·린트 통과 확인**

Run: `pnpm --filter @tablign/ui test && pnpm --filter @tablign/ui lint`
Expected: 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add packages/ui/src/MemberDialog.tsx packages/ui/src/InvitationList.tsx packages/ui/src/MemberAvatars.tsx packages/ui/src/icons.ts packages/ui/src/index.ts packages/ui/src/__tests__/MemberDialog.test.tsx packages/ui/src/__tests__/InvitationList.test.tsx
git commit -m "[기능] 멤버 관리·초대 목록·아바타 UI 컴포넌트"
```

---

### Task 6: 확장 — 사이드바 "공유됨" 섹션 + viewer 모드

**Files:**
- Modify: `apps/extension/src/newtab/ExtSidebar.tsx`
- Modify: `apps/extension/src/newtab/NewTab.tsx`
- Test: `apps/extension/src/newtab/NewTab.test.tsx` (케이스 추가)

**Interfaces:**
- Consumes: `@tablign/core`의 `listMyMemberships`, `updateMemberPosition`, `leaveSpace`, `type SpaceMember`
- Produces: 개인/공유 스페이스가 분리 렌더되고, 활성 스페이스에서 내 편집 권한(`canEdit`)에 따라 편집 진입점이 숨겨진다

- [ ] **Step 1: NewTab에 멤버십·권한 상태 추가**

`NewTab.tsx`:
- import에 `listMyMemberships, type SpaceMember` 추가(`@tablign/core`)
- 상태 추가:
  ```tsx
  const [memberships, setMemberships] = useState<SpaceMember[]>([]);
  ```
- 스페이스 로드 effect(현재 `listSpaces` 호출부)에서 멤버십도 함께 로드:
  ```tsx
      const [sp, ms] = await Promise.all([listSpaces(supabase), listMyMemberships(supabase)]);
      setSpaces(sp);
      setMemberships(ms);
      setSpacesLoaded(true);
  ```
  (`listSpaces`는 RLS 덕분에 이제 오너 스페이스 + 내가 멤버인 공유 스페이스를 모두 반환한다. `memberships`는 그중 "내가 멤버(비오너)인" 스페이스를 가려내고 각자 position을 얻기 위한 것.)
- 활성 스페이스 편집 권한 파생값 추가(렌더 상단, `userId` 근처):
  ```tsx
  const activeSpace = spaces.find((s) => s.id === activeSpaceId) ?? null;
  const myMembership = memberships.find((m) => m.space_id === activeSpaceId) ?? null;
  // 오너(멤버십에 없음)면 편집 가능, 멤버면 editor만 편집 가능
  const canEdit = activeSpace ? (myMembership ? myMembership.role === "editor" : true) : true;
  ```

- [ ] **Step 2: 실패하는 테스트 추가**

`NewTab.test.tsx`에 (상단 목에 `listMyMemberships` 추가: `const listMyMemberships = vi.fn();` + `vi.mock` 반환에 `listMyMemberships: (...a: unknown[]) => listMyMemberships(...a),` + beforeEach에 `listMyMemberships.mockReset(); listMyMemberships.mockResolvedValue([]);`):

```tsx
describe("NewTab — viewer 모드", () => {
  it("viewer로 연 공유 스페이스에서는 '＋ 컬렉션' 버튼이 숨겨진다", async () => {
    listSpaces.mockResolvedValue([
      { id: "shared1", user_id: "owner-x", name: "공유됨", icon: null, position: 1000, created_at: "x" },
    ]);
    listMyMemberships.mockResolvedValue([
      { space_id: "shared1", user_id: "u1", role: "viewer", position: 1000, created_at: "x" },
    ]);
    listCollections.mockResolvedValue([]);
    renderNewTab();
    await screen.findAllByText("공유됨");
    expect(screen.queryByRole("button", { name: /컬렉션$/ })).not.toBeInTheDocument();
  });

  it("editor로 연 공유 스페이스에서는 '＋ 컬렉션' 버튼이 보인다", async () => {
    listSpaces.mockResolvedValue([
      { id: "shared1", user_id: "owner-x", name: "공유됨", icon: null, position: 1000, created_at: "x" },
    ]);
    listMyMemberships.mockResolvedValue([
      { space_id: "shared1", user_id: "u1", role: "editor", position: 1000, created_at: "x" },
    ]);
    listCollections.mockResolvedValue([]);
    renderNewTab();
    await screen.findAllByText("공유됨");
    expect(screen.getByRole("button", { name: /컬렉션$/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: viewer 모드 — 편집 진입점 조건부 렌더**

`NewTab.tsx` 보드 헤더의 "＋ 컬렉션" 버튼과 컬렉션 편집 콜백을 `canEdit`로 가드:
- `<Button onClick={addCollection}>＋ 컬렉션</Button>`을 `{canEdit && <Button onClick={addCollection}>...</Button>}`로 감싼다.
- `CollectionSection`에 편집 관련 콜백을 canEdit일 때만 전달. 최소 변경으로, `CollectionSection` 렌더에서 `onRenameCollection`/`onDeleteCollection`/`onAddLink`/`moreMenuSlot`을 `canEdit ? (...) : undefined`로, `DndLinkList`의 편집 콜백도 canEdit 기준으로. (CollectionSection은 `onRenameCollection`이 undefined면 이름 편집 버튼을 이미 숨긴다 — 기존 구현 확인됨. `onAddLink`는 항상 요구되므로, viewer일 때는 no-op 함수를 넘기고 "＋ 링크 추가" 버튼 노출을 막으려면 CollectionSection에 `readOnly?: boolean` prop을 추가해야 한다.)

`packages/ui/src/CollectionSection.tsx`에 `readOnly?: boolean` prop 추가:
- 인터페이스에 `readOnly?: boolean;` 추가.
- 구조분해에 `readOnly` 추가.
- 링크 추가 버튼, 삭제 버튼, 이름 수정 연필, moreMenuSlot을 `!readOnly &&`로 감싼다.

그리고 `NewTab.tsx`에서 `<CollectionSection ... readOnly={!canEdit} />` 전달. (readOnly 추가는 UI 패키지 변경이므로 `packages/ui`도 함께 커밋. CollectionSection 기존 테스트가 readOnly 미지정 시 기존대로 동작하는지 확인.)

- [ ] **Step 4: 사이드바 "공유됨" 섹션 분리**

`ExtSidebar.tsx`:
- props에 추가: `sharedSpaces: Space[];` (memberships가 있는 스페이스), `onLeaveSpace: (id: string) => void;`
- 기존 `spaces`는 "내 소유" 스페이스만 받도록 NewTab에서 분리해 전달.
- SPACES 섹션 아래에 조건부로 "공유됨" 섹션 렌더 — 개인 섹션과 같은 행 UI를 재사용하되, 삭제 대신 "나가기"(LogOut 아이콘) 버튼. DnD 정렬은 이번 태스크에서는 생략하고 참여일 순 표시(스펙은 개인별 정렬을 원하나, 최소 출시 후 추가 가능 — 단, `log()`로 남기지 말고 주석으로 "정렬 미구현" 명시). **결정: 공유됨 섹션은 position 순으로 보여주되 DnD는 개인 스페이스에만 유지(범위 관리). 공유됨 섹션 정렬 DnD는 후속.**

`NewTab.tsx`에서 분리 전달:
```tsx
const ownedSpaces = spaces.filter((s) => !memberships.some((m) => m.space_id === s.id));
const sharedSpaces = spaces.filter((s) => memberships.some((m) => m.space_id === s.id));
// ExtSidebar에 spaces={ownedSpaces} sharedSpaces={sharedSpaces} 전달
```

`ExtSidebar`에 "공유됨" 섹션 마크업(개인 SPACES 블록 뒤):
```tsx
{sharedSpaces.length > 0 && (
  <>
    <div style={{ padding: "8px 14px 4px", fontSize: 10, letterSpacing: 1, color: theme.textFaint }}>공유됨</div>
    <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 2 }}>
      {sharedSpaces.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
          <button type="button" onClick={() => onSelectSpace(s.id)}
            style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
              background: s.id === activeSpaceId ? theme.accentWeak : "transparent", color: s.id === activeSpaceId ? theme.accent : "#495057", fontWeight: s.id === activeSpaceId ? 600 : 400 }}>
            <Hash size={15} /> {s.name}
          </button>
          <button type="button" title="나가기" aria-label="스페이스 나가기" onClick={() => onLeaveSpace(s.id)}
            style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 3 }}>
            <LogOut size={13} color={theme.textFaint} />
          </button>
        </div>
      ))}
    </div>
  </>
)}
```

`NewTab.tsx`에 `onLeaveSpace` 핸들러:
```tsx
async function handleLeaveSpace(id: string) {
  await leaveSpace(supabase, id, userId);
  const remaining = spaces.filter((s) => s.id !== id);
  setSpaces(remaining);
  setMemberships((prev) => prev.filter((m) => m.space_id !== id));
  if (activeSpaceId === id) setActiveSpaceId(remaining[0]?.id ?? null);
}
```
(import에 `leaveSpace` 추가.)

- [ ] **Step 5: 테스트·린트·빌드 확인**

Run: `pnpm --filter @tablign/ui test && pnpm --filter @tablign/extension test`
Expected: PASS (viewer 모드 2케이스 포함, CollectionSection 기존 테스트 유지)
Run: `pnpm --filter @tablign/extension lint && pnpm --filter @tablign/extension build`
Expected: 통과

- [ ] **Step 6: 커밋**

```bash
git add apps/extension/src/newtab/ExtSidebar.tsx apps/extension/src/newtab/NewTab.tsx apps/extension/src/newtab/NewTab.test.tsx packages/ui/src/CollectionSection.tsx
git commit -m "[기능] 사이드바 공유됨 섹션 및 viewer 읽기 전용 모드"
```

---

### Task 7: 확장 — 멤버 관리 다이얼로그 · 초대 알림 연결

**Files:**
- Modify: `apps/extension/src/newtab/NewTab.tsx`
- Test: `apps/extension/src/newtab/NewTab.test.tsx` (케이스 추가)

**Interfaces:**
- Consumes: `@tablign/core`의 `listMembers`/`removeMember`/`updateMemberRole`/`inviteToSpace`/`listSpaceInvitations`/`cancelInvitation`/`listMyInvitations`/`acceptInvitation`/`declineInvitation`, `@tablign/ui`의 `MemberDialog`/`InvitationList`/`MemberAvatars`
- Produces: 오너의 보드 헤더 "멤버" 버튼 → 멤버 관리 다이얼로그, 헤더 초대 알림 배지, 멤버 아바타 스택. 기능 완성.

- [ ] **Step 1: 실패하는 테스트 추가**

`NewTab.test.tsx`에 (목에 `listMembers`, `listSpaceInvitations`, `inviteToSpace`, `listMyInvitations`, `acceptInvitation` 추가; 각각 mockReset + 기본값 `[]`/`vi.fn()`):

```tsx
describe("NewTab — 멤버 관리·초대 알림", () => {
  it("오너 스페이스에서 멤버 버튼을 누르면 멤버 다이얼로그가 열린다", async () => {
    listSpaces.mockResolvedValue([{ id: "s1", user_id: "u1", name: "내 스페이스", icon: null, position: 1000, created_at: "x" }]);
    listMyMemberships.mockResolvedValue([]); // 내가 오너
    listCollections.mockResolvedValue([]);
    listMembers.mockResolvedValue([]);
    listSpaceInvitations.mockResolvedValue([]);
    renderNewTab();
    await screen.findAllByText("내 스페이스");
    fireEvent.click(screen.getByRole("button", { name: "멤버" }));
    expect(await screen.findByRole("dialog", { name: "멤버 관리" })).toBeInTheDocument();
  });

  it("받은 초대가 있으면 알림 배지가 보이고 수락하면 acceptInvitation을 호출한다", async () => {
    listSpaces.mockResolvedValue([{ id: "s1", user_id: "u1", name: "내 스페이스", icon: null, position: 1000, created_at: "x" }]);
    listMyMemberships.mockResolvedValue([]);
    listCollections.mockResolvedValue([]);
    listMyInvitations.mockResolvedValue([{ id: "inv1", space_id: "s9", inviter_id: "o9", invitee_email: "u1@test.local", role: "viewer", status: "pending", created_at: "x", space_name: "초대된 스페이스", inviter_name: "앨리스" }]);
    acceptInvitation.mockResolvedValue(undefined);
    renderNewTab();
    fireEvent.click(await screen.findByRole("button", { name: /초대/ }));
    fireEvent.click(await screen.findByRole("button", { name: "수락" }));
    await waitFor(() => expect(acceptInvitation).toHaveBeenCalledWith(expect.anything(), "inv1"));
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @tablign/extension test`
Expected: FAIL — "멤버" 버튼·초대 배지 없음

- [ ] **Step 3: 멤버 다이얼로그 연결**

`NewTab.tsx`:
- import 추가: `@tablign/core`에 `listMembers, removeMember, updateMemberRole, inviteToSpace, listSpaceInvitations, cancelInvitation, listMyInvitations, acceptInvitation, declineInvitation, type MemberWithProfile, type SpaceInvitation, type InvitationWithSpace`; `@tablign/ui`에 `MemberDialog, InvitationList, MemberAvatars, Users`(아이콘).
- 상태: `const [memberDialogOpen, setMemberDialogOpen] = useState(false);`, `const [members, setMembers] = useState<MemberWithProfile[]>([]);`, `const [pendingInvites, setPendingInvites] = useState<SpaceInvitation[]>([]);`, `const [myInvitations, setMyInvitations] = useState<InvitationWithSpace[]>([]);`, `const [inviteOpen, setInviteOpen] = useState(false);`
- 파생: `const isOwner = activeSpace ? activeSpace.user_id === userId : false;`
- 멤버 로드/열기:
  ```tsx
  async function openMemberDialog() {
    if (!activeSpaceId) return;
    setMemberDialogOpen(true);
    const [ms, invs] = await Promise.all([listMembers(supabase, activeSpaceId), listSpaceInvitations(supabase, activeSpaceId)]);
    setMembers(ms); setPendingInvites(invs);
  }
  async function reloadMembers() {
    if (!activeSpaceId) return;
    const [ms, invs] = await Promise.all([listMembers(supabase, activeSpaceId), listSpaceInvitations(supabase, activeSpaceId)]);
    setMembers(ms); setPendingInvites(invs);
  }
  async function handleInvite(email: string, role: "editor" | "viewer") {
    try { await inviteToSpace(supabase, activeSpaceId!, email, role); toast.show("초대를 보냈어요"); reloadMembers(); }
    catch (e) { console.error(e); toast.show("초대하지 못했어요. 이미 멤버이거나 잘못된 이메일일 수 있어요."); }
  }
  ```
- 초대 알림 로드(스페이스 로드 effect 또는 별도 effect에서 세션 있을 때):
  ```tsx
  useEffect(() => {
    if (!session) return;
    listMyInvitations(supabase).then(setMyInvitations).catch(console.error);
  }, [session]);
  ```
- 보드 헤더에 오너 전용 "멤버" 버튼 + 아바타 스택 (기존 `<Button onClick={addCollection}>` 옆):
  ```tsx
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    {members.length > 0 && <MemberAvatars people={members} />}
    {isOwner && (
      <Button variant="outline" onClick={openMemberDialog}><Users size={15} /> 멤버</Button>
    )}
    {canEdit && <Button onClick={addCollection}><Plus size={15} /> 컬렉션</Button>}
  </div>
  ```
  (활성 스페이스 진입 시 아바타 표시를 위해, loadCollections와 함께 `listMembers`를 호출해 `members`를 채우거나, openMemberDialog 시에만 채운다. 최소 구현: 활성 스페이스가 바뀌면 members를 비우고, 공유 스페이스일 때만 listMembers 호출하는 effect 추가.)
  ```tsx
  useEffect(() => {
    if (!activeSpaceId) { setMembers([]); return; }
    listMembers(supabase, activeSpaceId).then(setMembers).catch(() => setMembers([]));
  }, [activeSpaceId]);
  ```
- 헤더 알림 배지(초대 팝오버) — 보드 상단 우측 또는 사이드바. 최소 구현으로 보드 헤더 좌측 영역에 초대 개수 배지 버튼 + 팝오버:
  ```tsx
  const [inviteOpen, setInviteOpen] = useState(false);
  // 헤더에:
  <span style={{ position: "relative" }}>
    <Button variant="outline" onClick={() => setInviteOpen((v) => !v)}>초대 {myInvitations.length > 0 ? `(${myInvitations.length})` : ""}</Button>
    {inviteOpen && (
      <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 60, background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 10, boxShadow: "0 8px 20px rgba(20,30,60,.14)" }}>
        <InvitationList
          invitations={myInvitations.map((i) => ({ id: i.id, space_name: i.space_name, inviter_name: i.inviter_name, role: i.role }))}
          onAccept={async (id) => { await acceptInvitation(supabase, id); setInviteOpen(false); await refreshAll(); }}
          onDecline={async (id) => { await declineInvitation(supabase, id); setMyInvitations((prev) => prev.filter((x) => x.id !== id)); }}
        />
      </div>
    )}
  </span>
  ```
  `refreshAll`: 초대 수락 후 스페이스·멤버십·초대 목록을 다시 로드하고 새 스페이스로 이동:
  ```tsx
  async function refreshAll() {
    const [sp, ms, invs] = await Promise.all([listSpaces(supabase), listMyMemberships(supabase), listMyInvitations(supabase)]);
    setSpaces(sp); setMemberships(ms); setMyInvitations(invs);
    toast.show("스페이스에 참여했어요");
  }
  ```
- 다이얼로그 렌더(최하단, 다른 다이얼로그 옆):
  ```tsx
  <MemberDialog
    open={memberDialogOpen}
    spaceName={activeSpace?.name ?? ""}
    members={members.map((m) => ({ user_id: m.user_id, role: m.role, display_name: m.display_name, avatar_url: m.avatar_url }))}
    pendingInvites={pendingInvites.map((i) => ({ id: i.id, invitee_email: i.invitee_email, role: i.role }))}
    onInvite={handleInvite}
    onChangeRole={async (uid, role) => { await updateMemberRole(supabase, activeSpaceId!, uid, role); reloadMembers(); }}
    onRemove={async (uid) => { await removeMember(supabase, activeSpaceId!, uid); reloadMembers(); }}
    onCancelInvite={async (id) => { await cancelInvitation(supabase, id); reloadMembers(); }}
    onClose={() => setMemberDialogOpen(false)}
  />
  ```

- [ ] **Step 4: 테스트·린트·빌드 확인**

Run: `pnpm --filter @tablign/extension test`
Expected: PASS (신규 2케이스 포함)
Run: `pnpm --filter @tablign/extension lint && pnpm --filter @tablign/extension build`
Expected: 통과
Run: `pnpm test` (루트 전체)
Expected: 전부 PASS

- [ ] **Step 5: 수동 검증 (크롬, 계정 2개)**

1. `pnpm --filter @tablign/extension build` 후 dist 재로드
2. 계정 A: 스페이스 → 보드 헤더 "멤버" → 계정 B 이메일로 편집자 초대 → 대기 중 표시 확인
3. 계정 B: 새 탭 헤더 "초대(1)" → 수락 → 사이드바 "공유됨" 섹션에 스페이스 등장
4. 계정 B(editor): 컬렉션·링크 추가 → 계정 A가 **스페이스를 재선택하면** 반영 확인 (라이브 실시간 동기화는 이번 범위 밖 — 아래 "범위에서 제외" 참고)
5. 계정 A: 멤버 다이얼로그에서 B를 뷰어로 변경 → B 화면에서 스페이스 재선택 시 "＋ 컬렉션" 사라짐
6. 계정 B: 사이드바 "나가기" → 공유됨 섹션에서 사라짐
7. 오너 아닌 계정에는 "멤버" 버튼이 안 보이는지, viewer는 편집 진입점이 없는지

- [ ] **Step 6: 커밋**

```bash
git add apps/extension/src/newtab/NewTab.tsx apps/extension/src/newtab/NewTab.test.tsx
git commit -m "[기능] 멤버 관리 다이얼로그 및 초대 알림 연결"
```

---

## 범위에서 제외 (후속 과제)

- **라이브 실시간 동기화**: 스펙 §5-3은 "기존 Realtime 구독으로 자동 반영"을 전제했으나, 익스텐션 NewTab에는 Postgres 변경 구독 인프라가 없다(auth 상태만 구독). 멤버 간 변경은 **스페이스 재선택/새로고침 시 반영**되며, 라이브 동기화(구독 + DnD 상태와의 조정)는 규모·리스크가 커 별도 과제로 분리한다. 마이그레이션은 `space_members`/`space_invitations`를 publication에 등록해 두어 후속 구현 시 바로 쓸 수 있게 한다.
- 공유됨 섹션의 **멤버별 DnD 정렬**: `space_members.position` 컬럼·`updateMemberPosition` 함수는 준비하되, 사이드바 DnD 정렬 UI는 후속(참여 순 표시).
- 오너 양도 / 오너 나가기 (스펙 §9).

## 배포 주의

- 3단계는 마이그레이션 0010~0012 추가. 머지 후 **원격 반영 필요**: `npx supabase db push` (PR 머지 ≠ 원격 DB 반영).
- RLS 전면 개편(0011)이라 원격 반영 전 로컬에서 기존 테스트 전부 통과를 반드시 확인한다.
