# 컬렉션 공유 코드 구현 계획 (공유 2단계)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 컬렉션에 공유 코드를 발급하고, 받은 사람이 코드를 입력해 자기 스페이스로 스냅샷 복사(가져오기)할 수 있게 한다.

**Architecture:** 코드 발급·조회·가져오기는 전부 Postgres RPC(security definer)로 처리한다. 코드는 비밀값이라 `collection_share_codes` 테이블의 RLS select는 발급자만 허용하고, 타인의 코드 조회·가져오기는 RPC 내부에서만 이뤄진다. 1단계의 `copy_collection`은 권한 검증 없는 내부 헬퍼 `copy_collection_rows`로 분리해 `import_collection_by_code`와 공유한다. UI는 `CollectionMoreMenu`에 "공유 코드" 항목을 추가하고, 발급(`ShareCodeDialog`)·가져오기(`ImportCodeDialog`) 다이얼로그를 packages/ui에 만든 뒤 확장에서 연결한다.

**Tech Stack:** Supabase(PostgreSQL RPC, RLS), TypeScript, React, vitest + @testing-library/react, pnpm workspace

**설계 문서:** `docs/superpowers/specs/2026-07-03-sharing-design.md` (2·5-2·6절)

**스펙 대비 의도적 변경:** 스펙 6절은 "만료된 코드"와 "존재하지 않는 코드"를 구분한 메시지를 제안했지만, 구분하려면 RPC가 코드의 존재 여부를 노출해야 한다. 코드는 비밀값이므로 두 경우를 하나의 에러("찾을 수 없거나 만료된 코드예요")로 통합한다 — 무차별 대입으로 유효 코드를 탐지하기 어렵게 하는 보안상 이점이 있다.

## Global Constraints

- Node >= 20, pnpm 10.15.0 / 새 외부 의존성 금지 / UI 문구·주석 한국어
- 코드 형식: **8자**, 혼동 문자 제외 알파벳 `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (0,1,I,L,O 제외)
- 만료 기본 **7일**, 무기한(null) 선택 가능. 회수는 `revoked_at` 기록(행 삭제 아님)
- 컬렉션당 **활성 코드는 1개**: 이미 활성 코드가 있으면 발급 RPC가 그 코드를 반환
- 태그는 복사하지 않음(설계 결정). position은 GAP=1000 규칙, insert 내 서브쿼리로 경합 회피(0006 관례)
- RPC는 `security definer set search_path = public`, execute는 authenticated에게만 (내부 헬퍼는 authenticated에게도 revoke)
- 통합 테스트는 로컬 Supabase(`npx supabase start`) + `packages/core/.env.test`. 마이그레이션 적용은 `npx supabase db reset`
- 기존 `copy_collection` 동작·시그니처 불변 (기존 테스트 `copy-collection.test.ts`가 그대로 통과해야 함)
- 커밋 관례: fe-toolkit 팀 컨벤션 `[타입] 내용` (기능/수정 등, 한국어 명사형, 50자 이내), 본문은 제목으로 부족할 때만

---

### Task 1: `collection_share_codes` 테이블 + 발급 RPC (마이그레이션 0008)

**Files:**
- Create: `supabase/migrations/0008_share_codes.sql`
- Test: `packages/core/src/__tests__/share.test.ts` (새 파일)

**Interfaces:**
- Produces:
  - 테이블 `collection_share_codes(code text pk, collection_id uuid fk cascade, created_by uuid fk cascade, expires_at timestamptz null, revoked_at timestamptz null, created_at)`
  - RLS: select/update는 `created_by = auth.uid()`만. insert/delete 정책 없음(직접 불가, 발급은 RPC 경유)
  - SQL 함수 `create_collection_share_code(p_collection_id uuid, p_expires_in_days int default 7) returns table(code text, expires_at timestamptz)` — 활성 코드가 있으면 그것을 반환, 없으면 생성. `p_expires_in_days`가 null이면 무기한

- [ ] **Step 1: 실패하는 통합 테스트 작성**

`packages/core/src/__tests__/share.test.ts` 생성. `copy-collection.test.ts`의 `makeUser`·env 파서 패턴을 그대로 복사해 사용한다.

```typescript
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
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password: "password123", email_confirm: true,
  });
  if (createErr) throw createErr;
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: "password123" });
  if (signInErr) throw signInErr;
  return { client, id: created.user!.id };
}

// 파일 최상위 공유 픽스처: alice(발급자), bob(가져가는 사람)
let alice: { client: SupabaseClient; id: string };
let bob: { client: SupabaseClient; id: string };
let aliceSpaceId: string;
let aliceColId: string;   // 링크 2개를 가진 alice의 컬렉션
let bobSpaceId: string;

beforeAll(async () => {
  alice = await makeUser(`share-alice-${Date.now()}@test.local`);
  bob = await makeUser(`share-bob-${Date.now()}@test.local`);

  const { data: s } = await alice.client.from("spaces")
    .insert({ user_id: alice.id, name: "Alice 스페이스" }).select().single();
  aliceSpaceId = s!.id;
  const { data: c } = await alice.client.from("collections")
    .insert({ user_id: alice.id, space_id: aliceSpaceId, title: "공유할 자료", icon: "📌" })
    .select().single();
  aliceColId = c!.id;
  await alice.client.from("links").insert([
    { user_id: alice.id, collection_id: aliceColId, url: "https://a.com", title: "A", position: 1000 },
    { user_id: alice.id, collection_id: aliceColId, url: "https://b.com", title: "B", position: 2000 },
  ]);

  const { data: bs } = await bob.client.from("spaces")
    .insert({ user_id: bob.id, name: "Bob 스페이스" }).select().single();
  bobSpaceId = bs!.id;
});

describe("create_collection_share_code RPC", () => {
  it("8자 코드(혼동 문자 제외)와 7일 만료를 발급한다", async () => {
    const { data, error } = await alice.client.rpc("create_collection_share_code", {
      p_collection_id: aliceColId,
    });
    expect(error).toBeNull();
    const row = data![0];
    expect(row.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    const days = (new Date(row.expires_at).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it("활성 코드가 있으면 새로 만들지 않고 같은 코드를 반환한다", async () => {
    const { data: first } = await alice.client.rpc("create_collection_share_code", { p_collection_id: aliceColId });
    const { data: second } = await alice.client.rpc("create_collection_share_code", { p_collection_id: aliceColId });
    expect(second![0].code).toBe(first![0].code);
  });

  it("발급자는 자기 코드를 조회하고 회수할 수 있다", async () => {
    const { data } = await alice.client.rpc("create_collection_share_code", { p_collection_id: aliceColId });
    const code = data![0].code;
    const { data: mine } = await alice.client.from("collection_share_codes").select().eq("code", code);
    expect(mine).toHaveLength(1);
    const { error } = await alice.client.from("collection_share_codes")
      .update({ revoked_at: new Date().toISOString() }).eq("code", code);
    expect(error).toBeNull();
    // 회수 후 재발급하면 새 코드가 나온다
    const { data: reissued } = await alice.client.rpc("create_collection_share_code", { p_collection_id: aliceColId });
    expect(reissued![0].code).not.toBe(code);
  });

  it("타인 코드는 테이블 조회로 보이지 않는다 (코드는 비밀값)", async () => {
    const { data } = await bob.client.from("collection_share_codes").select();
    expect(data).toHaveLength(0);
  });

  it("남의 컬렉션에는 코드를 발급할 수 없다", async () => {
    const { error } = await bob.client.rpc("create_collection_share_code", { p_collection_id: aliceColId });
    expect(error).not.toBeNull();
  });

  it("무기한(null) 발급이 가능하다", async () => {
    // 기존 활성 코드를 회수한 뒤 무기한으로 발급
    await alice.client.from("collection_share_codes")
      .update({ revoked_at: new Date().toISOString() }).eq("collection_id", aliceColId);
    const { data } = await alice.client.rpc("create_collection_share_code", {
      p_collection_id: aliceColId, p_expires_in_days: null,
    });
    expect(data![0].expires_at).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

로컬 Supabase 실행 중이어야 한다 (`npx supabase status`로 확인, 꺼져 있으면 `npx supabase start`).

Run: `pnpm --filter @tablign/core test -- share`
Expected: FAIL — `Could not find the function public.create_collection_share_code` 류

- [ ] **Step 3: 마이그레이션 작성**

`supabase/migrations/0008_share_codes.sql` 생성:

```sql
-- 컬렉션 공유 코드 (공유 2단계)
-- 코드는 비밀값: 테이블 직접 조회는 발급자만, 코드로 열람·가져오기는 RPC 내부에서만 이뤄진다.
create table public.collection_share_codes (
  code          text primary key,
  collection_id uuid not null references public.collections(id) on delete cascade,
  created_by    uuid not null references auth.users(id) on delete cascade,
  expires_at    timestamptz,             -- null = 무기한
  revoked_at    timestamptz,             -- 발급자가 회수
  created_at    timestamptz not null default now()
);
create index collection_share_codes_collection_id_idx on public.collection_share_codes(collection_id);

alter table public.collection_share_codes enable row level security;

-- select/update(회수)는 발급자만. insert/delete 정책 없음 → 직접 불가(발급은 RPC 경유).
create policy "share_codes_select_own" on public.collection_share_codes
  for select using (auth.uid() = created_by);
create policy "share_codes_update_own" on public.collection_share_codes
  for update using (auth.uid() = created_by) with check (auth.uid() = created_by);

-- 발급 RPC: 활성 코드가 있으면 반환, 없으면 생성. p_expires_in_days null = 무기한.
create function public.create_collection_share_code(
  p_collection_id uuid,
  p_expires_in_days int default 7
)
returns table(code text, expires_at timestamptz)
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';  -- 0,1,I,L,O 제외
  v_code text;
  v_expires timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- 2단계(개인 전용): 컬렉션의 스페이스 소유자만 발급. 3단계에서 can_edit_space 기반으로 교체 예정.
  if not exists (
    select 1 from collections c join spaces s on s.id = c.space_id
    where c.id = p_collection_id and s.user_id = v_uid
  ) then
    raise exception 'collection not found or not accessible';
  end if;

  -- 활성 코드(미회수·미만료)가 있으면 그대로 반환 → 컬렉션당 활성 코드 1개 유지
  return query
    select s.code, s.expires_at from collection_share_codes s
    where s.collection_id = p_collection_id
      and s.revoked_at is null
      and (s.expires_at is null or s.expires_at > now());
  if found then return; end if;

  v_expires := case when p_expires_in_days is null then null
                    else now() + make_interval(days => p_expires_in_days) end;

  -- 8자 랜덤 코드 생성. pk 충돌 시 재시도.
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    begin
      insert into collection_share_codes(code, collection_id, created_by, expires_at)
      values (v_code, p_collection_id, v_uid, v_expires);
      exit;
    exception when unique_violation then
      -- 충돌 확률은 낮지만 재시도
    end;
  end loop;

  return query select v_code, v_expires;
end;
$$;

revoke execute on function public.create_collection_share_code(uuid, int) from public, anon;
grant execute on function public.create_collection_share_code(uuid, int) to authenticated;
```

- [ ] **Step 4: 마이그레이션 적용 후 테스트 통과 확인**

Run: `npx supabase db reset` (루트에서, 0001~0008 재적용)
Run: `pnpm --filter @tablign/core test -- share`
Expected: PASS (6 tests)

기존 테스트 확인: `pnpm --filter @tablign/core test` → 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0008_share_codes.sql packages/core/src/__tests__/share.test.ts
git commit -m "feat(db): 컬렉션 공유 코드 테이블·발급 RPC"
```

---

### Task 2: 조회·가져오기 RPC (마이그레이션 0009)

**Files:**
- Create: `supabase/migrations/0009_share_import.sql`
- Test: `packages/core/src/__tests__/share.test.ts` (describe 블록 추가)

**Interfaces:**
- Consumes: Task 1의 테이블·발급 RPC, 0006의 `copy_collection`
- Produces:
  - 내부 헬퍼 `copy_collection_rows(p_collection_id, p_target_space_id, p_owner) returns uuid` — 권한 검증 없는 딥카피(authenticated에게도 execute revoke)
  - `copy_collection`은 검증 후 헬퍼에 위임하도록 `create or replace` (동작·시그니처 불변)
  - `get_share_code_info(p_code text) returns table(title text, icon text, link_count bigint, shared_by text)` — 활성 코드 검증 후 미리보기 정보
  - `import_collection_by_code(p_code text, p_target_space_id uuid) returns uuid` — 활성 코드 + 대상 스페이스 소유 검증 후 딥카피

- [ ] **Step 1: 실패하는 테스트 추가**

`share.test.ts` 끝에 describe 블록 추가:

```typescript
describe("get_share_code_info / import_collection_by_code RPC", () => {
  let activeCode: string;

  beforeAll(async () => {
    // 이전 테스트가 회수했을 수 있으므로 새 활성 코드를 확보
    const { data } = await alice.client.rpc("create_collection_share_code", { p_collection_id: aliceColId });
    activeCode = data![0].code;
  });

  it("발급자가 아니어도 코드로 미리보기 정보를 얻는다", async () => {
    const { data, error } = await bob.client.rpc("get_share_code_info", { p_code: activeCode });
    expect(error).toBeNull();
    const info = data![0];
    expect(info.title).toBe("공유할 자료");
    expect(info.icon).toBe("📌");
    expect(Number(info.link_count)).toBe(2);
    expect(typeof info.shared_by === "string" || info.shared_by === null).toBe(true);
  });

  it("존재하지 않는 코드는 에러", async () => {
    const { error } = await bob.client.rpc("get_share_code_info", { p_code: "XXXXXXXX" });
    expect(error).not.toBeNull();
  });

  it("코드로 자기 스페이스에 컬렉션을 가져온다 (링크 포함, 소유자는 가져간 사람)", async () => {
    const { data: newId, error } = await bob.client.rpc("import_collection_by_code", {
      p_code: activeCode, p_target_space_id: bobSpaceId,
    });
    expect(error).toBeNull();
    const { data: copied } = await bob.client.from("collections").select().eq("id", newId).single();
    expect(copied!.title).toBe("공유할 자료");
    expect(copied!.space_id).toBe(bobSpaceId);
    expect(copied!.user_id).toBe(bob.id);
    const { data: links } = await bob.client.from("links")
      .select().eq("collection_id", newId).order("position");
    expect(links!.map((l) => l.url)).toEqual(["https://a.com", "https://b.com"]);
    // 원본은 그대로
    const { data: original } = await alice.client.from("links").select().eq("collection_id", aliceColId);
    expect(original).toHaveLength(2);
  });

  it("남의 스페이스로는 가져올 수 없다", async () => {
    const { error } = await bob.client.rpc("import_collection_by_code", {
      p_code: activeCode, p_target_space_id: aliceSpaceId,
    });
    expect(error).not.toBeNull();
  });

  it("회수된 코드는 조회·가져오기 모두 에러", async () => {
    await alice.client.from("collection_share_codes")
      .update({ revoked_at: new Date().toISOString() }).eq("code", activeCode);
    const { error: infoErr } = await bob.client.rpc("get_share_code_info", { p_code: activeCode });
    expect(infoErr).not.toBeNull();
    const { error: impErr } = await bob.client.rpc("import_collection_by_code", {
      p_code: activeCode, p_target_space_id: bobSpaceId,
    });
    expect(impErr).not.toBeNull();
  });

  it("만료된 코드는 가져올 수 없다", async () => {
    // p_expires_in_days = 0 → 발급 즉시 만료
    const { data } = await alice.client.rpc("create_collection_share_code", {
      p_collection_id: aliceColId, p_expires_in_days: 0,
    });
    const expired = data![0].code;
    const { error } = await bob.client.rpc("import_collection_by_code", {
      p_code: expired, p_target_space_id: bobSpaceId,
    });
    expect(error).not.toBeNull();
  });

  it("발급자 본인도 코드로 가져올 수 있다 (내 스페이스 간 복사와 동일 효과)", async () => {
    // 만료 코드 정리 후 새 활성 코드 발급
    await alice.client.from("collection_share_codes")
      .update({ revoked_at: new Date().toISOString() }).eq("collection_id", aliceColId);
    const { data } = await alice.client.rpc("create_collection_share_code", { p_collection_id: aliceColId });
    const { data: newId, error } = await alice.client.rpc("import_collection_by_code", {
      p_code: data![0].code, p_target_space_id: aliceSpaceId,
    });
    expect(error).toBeNull();
    expect(newId).not.toBe(aliceColId);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @tablign/core test -- share`
Expected: FAIL — `Could not find the function public.get_share_code_info` 류

- [ ] **Step 3: 마이그레이션 작성**

`supabase/migrations/0009_share_import.sql` 생성:

```sql
-- 공유 코드 조회·가져오기 (공유 2단계)

-- 내부 전용 딥카피 헬퍼: 권한 검증 없음. copy_collection과 import_collection_by_code가 공유한다.
-- authenticated에게도 execute를 회수해 오직 definer 함수 내부에서만 호출된다.
create function public.copy_collection_rows(
  p_collection_id uuid,
  p_target_space_id uuid,
  p_owner uuid
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_new_id uuid;
begin
  insert into collections (space_id, user_id, title, icon, note, position)
  select p_target_space_id, p_owner, title, icon, note,
         (select coalesce(max(position), 0) + 1000 from collections where space_id = p_target_space_id)
  from collections where id = p_collection_id
  returning id into v_new_id;

  insert into links (collection_id, user_id, url, title, favicon_url, thumbnail_url, custom_title, note, position)
  select v_new_id, p_owner, url, title, favicon_url, thumbnail_url, custom_title, note, position
  from links where collection_id = p_collection_id;

  return v_new_id;
end;
$$;

revoke execute on function public.copy_collection_rows(uuid, uuid, uuid) from public, anon, authenticated;

-- copy_collection: 검증은 유지하고 복사 본문만 헬퍼에 위임 (동작·시그니처 불변)
create or replace function public.copy_collection(p_collection_id uuid, p_target_space_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from collections c join spaces s on s.id = c.space_id
    where c.id = p_collection_id and s.user_id = v_uid
  ) then
    raise exception 'source collection not found or not accessible';
  end if;
  if not exists (
    select 1 from spaces where id = p_target_space_id and user_id = v_uid
  ) then
    raise exception 'target space not found or not editable';
  end if;
  return copy_collection_rows(p_collection_id, p_target_space_id, v_uid);
end;
$$;

-- 코드 미리보기: 활성 코드면 컬렉션 이름·아이콘·링크 수·공유한 사람 이름을 돌려준다.
create function public.get_share_code_info(p_code text)
returns table(title text, icon text, link_count bigint, shared_by text)
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  return query
    select c.title, c.icon,
           (select count(*) from links l where l.collection_id = c.id),
           p.display_name
    from collection_share_codes s
    join collections c on c.id = s.collection_id
    left join profiles p on p.id = s.created_by
    where s.code = p_code
      and s.revoked_at is null
      and (s.expires_at is null or s.expires_at > now());
  if not found then
    raise exception 'share code not found or expired';
  end if;
end;
$$;

revoke execute on function public.get_share_code_info(text) from public, anon;
grant execute on function public.get_share_code_info(text) to authenticated;

-- 코드로 가져오기: 활성 코드 + 대상 스페이스 소유 검증 후 스냅샷 복사.
create function public.import_collection_by_code(p_code text, p_target_space_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_collection_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select s.collection_id into v_collection_id
  from collection_share_codes s
  where s.code = p_code
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > now());
  if v_collection_id is null then
    raise exception 'share code not found or expired';
  end if;

  if not exists (
    select 1 from spaces where id = p_target_space_id and user_id = v_uid
  ) then
    raise exception 'target space not found or not editable';
  end if;

  return copy_collection_rows(v_collection_id, p_target_space_id, v_uid);
end;
$$;

revoke execute on function public.import_collection_by_code(text, uuid) from public, anon;
grant execute on function public.import_collection_by_code(text, uuid) to authenticated;
```

- [ ] **Step 4: 적용 후 전체 테스트 통과 확인**

Run: `npx supabase db reset`
Run: `pnpm --filter @tablign/core test`
Expected: 전부 PASS — 특히 기존 `copy-collection.test.ts`(copy_collection 위임 리팩터의 회귀 검증)와 신규 share 테스트 13개

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0009_share_import.sql packages/core/src/__tests__/share.test.ts
git commit -m "feat(db): 공유 코드 미리보기·가져오기 RPC 및 복사 헬퍼 분리"
```

---

### Task 3: core 데이터 함수 (`share.ts`)

**Files:**
- Create: `packages/core/src/data/share.ts`
- Modify: `packages/core/src/index.ts` (`export * from "./data/share";` 추가)
- Test: `packages/core/src/__tests__/share.test.ts` (describe 블록 추가)

**Interfaces:**
- Consumes: Task 1·2의 RPC들
- Produces (`@tablign/core`에서 export):
  ```typescript
  export interface ShareCode { code: string; expires_at: string | null }
  export interface ShareCodeInfo { title: string; icon: string | null; link_count: number; shared_by: string | null }
  createCollectionShareCode(client, collectionId, expiresInDays?: number | null): Promise<ShareCode>  // 기본 7일, null=무기한
  revokeCollectionShareCode(client, code): Promise<void>
  getShareCodeInfo(client, code): Promise<ShareCodeInfo>
  importCollectionByCode(client, code, targetSpaceId): Promise<string>  // 새 컬렉션 id
  ```

- [ ] **Step 1: 실패하는 테스트 추가**

`share.test.ts` 상단 import에 추가:

```typescript
import {
  createCollectionShareCode, revokeCollectionShareCode, getShareCodeInfo, importCollectionByCode,
} from "../data/share";
```

파일 끝에 describe 추가:

```typescript
describe("share 데이터 함수 (core)", () => {
  it("발급 → 조회 → 가져오기 → 회수 전체 흐름", async () => {
    // 남아 있을 수 있는 활성 코드 정리
    await alice.client.from("collection_share_codes")
      .update({ revoked_at: new Date().toISOString() }).eq("collection_id", aliceColId);

    const issued = await createCollectionShareCode(alice.client, aliceColId);
    expect(issued.code).toHaveLength(8);
    expect(issued.expires_at).not.toBeNull();

    const info = await getShareCodeInfo(bob.client, issued.code);
    expect(info.title).toBe("공유할 자료");
    expect(info.link_count).toBe(2);

    const newId = await importCollectionByCode(bob.client, issued.code, bobSpaceId);
    expect(typeof newId).toBe("string");

    await revokeCollectionShareCode(alice.client, issued.code);
    await expect(getShareCodeInfo(bob.client, issued.code)).rejects.toBeTruthy();
  });

  it("무기한 발급 시 expires_at이 null이다", async () => {
    await alice.client.from("collection_share_codes")
      .update({ revoked_at: new Date().toISOString() }).eq("collection_id", aliceColId);
    const issued = await createCollectionShareCode(alice.client, aliceColId, null);
    expect(issued.expires_at).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @tablign/core test -- share`
Expected: FAIL — 모듈 `../data/share` 없음

- [ ] **Step 3: 구현**

`packages/core/src/data/share.ts` 생성:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ShareCode {
  code: string;
  expires_at: string | null;
}

export interface ShareCodeInfo {
  title: string;
  icon: string | null;
  link_count: number;
  shared_by: string | null;
}

/** 컬렉션 공유 코드를 발급한다. 활성 코드가 있으면 그것을 반환. expiresInDays null=무기한(기본 7일). */
export async function createCollectionShareCode(
  client: SupabaseClient,
  collectionId: string,
  expiresInDays: number | null = 7,
): Promise<ShareCode> {
  const { data, error } = await client.rpc("create_collection_share_code", {
    p_collection_id: collectionId,
    p_expires_in_days: expiresInDays,
  });
  if (error) throw error;
  return (data as ShareCode[])[0];
}

/** 발급자가 코드를 회수한다(이후 조회·가져오기 불가). */
export async function revokeCollectionShareCode(client: SupabaseClient, code: string): Promise<void> {
  const { error } = await client
    .from("collection_share_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("code", code);
  if (error) throw error;
}

/** 코드의 미리보기 정보(컬렉션 이름·링크 수·공유한 사람). 만료·회수·미존재면 throw. */
export async function getShareCodeInfo(client: SupabaseClient, code: string): Promise<ShareCodeInfo> {
  const { data, error } = await client.rpc("get_share_code_info", { p_code: code });
  if (error) throw error;
  const row = (data as (Omit<ShareCodeInfo, "link_count"> & { link_count: number | string })[])[0];
  return { ...row, link_count: Number(row.link_count) };
}

/** 코드로 컬렉션을 대상 스페이스에 스냅샷 복사하고 새 컬렉션 id를 반환한다. */
export async function importCollectionByCode(
  client: SupabaseClient,
  code: string,
  targetSpaceId: string,
): Promise<string> {
  const { data, error } = await client.rpc("import_collection_by_code", {
    p_code: code,
    p_target_space_id: targetSpaceId,
  });
  if (error) throw error;
  return data as string;
}
```

`packages/core/src/index.ts`에 `export * from "./data/share";` 추가.

- [ ] **Step 4: 테스트·린트 통과 확인**

Run: `pnpm --filter @tablign/core test && pnpm --filter @tablign/core lint`
Expected: 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/data/share.ts packages/core/src/index.ts packages/core/src/__tests__/share.test.ts
git commit -m "feat(core): 공유 코드 발급·조회·가져오기 함수"
```

---

### Task 4: UI — 메뉴 항목 + `ShareCodeDialog` + `ImportCodeDialog`

**Files:**
- Modify: `packages/ui/src/CollectionMoreMenu.tsx` (`onShare` prop, 스페이스 0개 대응)
- Create: `packages/ui/src/ShareCodeDialog.tsx`
- Create: `packages/ui/src/ImportCodeDialog.tsx`
- Modify: `packages/ui/src/index.ts` (두 다이얼로그 export)
- Test: `packages/ui/src/__tests__/ShareCodeDialog.test.tsx`, `packages/ui/src/__tests__/ImportCodeDialog.test.tsx`, `packages/ui/src/__tests__/CollectionMoreMenu.test.tsx`(케이스 추가)

**Interfaces:**
- Produces:
  ```typescript
  // CollectionMoreMenu에 추가
  onShare?: () => void;   // 있으면 루트 메뉴에 "공유 코드" 항목. spaces가 비어도 onShare만으로 메뉴 동작

  export interface ShareCodeDialogProps {
    open: boolean;
    collectionTitle: string;
    /** null이면 만료 선택 화면, 값이 있으면 코드 표시 화면 */
    issued: { code: string; expires_at: string | null } | null;
    onIssue: (expiresInDays: number | null) => void;   // 7 또는 null(무기한)
    onRevoke: () => void;
    onClose: () => void;
  }
  export function ShareCodeDialog(props: ShareCodeDialogProps): JSX.Element | null

  export interface ImportCodeDialogProps {
    open: boolean;
    spaces: SpaceOption[];                             // 가져올 대상 스페이스 목록
    onLookup: (code: string) => Promise<{ title: string; icon: string | null; link_count: number; shared_by: string | null }>;
    onImport: (code: string, spaceId: string) => Promise<void>;
    onClose: () => void;
  }
  export function ImportCodeDialog(props: ImportCodeDialogProps): JSX.Element | null
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/ui/src/__tests__/CollectionMoreMenu.test.tsx`에 케이스 추가:

```tsx
  it("onShare가 있으면 '공유 코드' 항목이 보이고 클릭 시 호출된다", () => {
    const onShare = vi.fn();
    render(<CollectionMoreMenu spaces={spaces} onMove={noop} onCopy={noop} onShare={onShare} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 메뉴" }));
    fireEvent.click(screen.getByText("공유 코드"));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("공유 코드")).not.toBeInTheDocument(); // 팝오버 닫힘
  });

  it("다른 스페이스가 없어도 onShare만으로 메뉴가 뜬다", () => {
    render(<CollectionMoreMenu spaces={[]} onMove={noop} onCopy={noop} onShare={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 메뉴" }));
    expect(screen.getByText("공유 코드")).toBeInTheDocument();
    expect(screen.queryByText("다른 스페이스로 이동")).not.toBeInTheDocument();
  });
```

`packages/ui/src/__tests__/ShareCodeDialog.test.tsx` 생성:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShareCodeDialog } from "../ShareCodeDialog";

function noop() {}

describe("ShareCodeDialog", () => {
  it("issued가 없으면 만료 선택 화면을 보여주고 발급을 호출한다", () => {
    const onIssue = vi.fn();
    render(<ShareCodeDialog open collectionTitle="자료" issued={null} onIssue={onIssue} onRevoke={noop} onClose={noop} />);
    fireEvent.click(screen.getByRole("button", { name: /7일 코드 만들기/ }));
    expect(onIssue).toHaveBeenCalledWith(7);
    fireEvent.click(screen.getByRole("button", { name: /무기한 코드 만들기/ }));
    expect(onIssue).toHaveBeenCalledWith(null);
  });

  it("issued가 있으면 코드와 회수 버튼을 보여준다", () => {
    const onRevoke = vi.fn();
    render(
      <ShareCodeDialog open collectionTitle="자료" issued={{ code: "ABCD2345", expires_at: null }}
        onIssue={noop} onRevoke={onRevoke} onClose={noop} />,
    );
    expect(screen.getByText("ABCD2345")).toBeInTheDocument();
    expect(screen.getByText(/무기한/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /회수/ }));
    expect(onRevoke).toHaveBeenCalledTimes(1);
  });

  it("open=false면 렌더하지 않는다", () => {
    const { container } = render(
      <ShareCodeDialog open={false} collectionTitle="자료" issued={null} onIssue={noop} onRevoke={noop} onClose={noop} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
```

`packages/ui/src/__tests__/ImportCodeDialog.test.tsx` 생성:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImportCodeDialog } from "../ImportCodeDialog";

const spaces = [{ id: "s1", name: "개인", icon: null }];
function noop() {}

describe("ImportCodeDialog", () => {
  it("코드 조회 후 미리보기와 스페이스 선택을 보여주고 가져오기를 호출한다", async () => {
    const onLookup = vi.fn().mockResolvedValue({ title: "공유 자료", icon: null, link_count: 3, shared_by: "앨리스" });
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(<ImportCodeDialog open spaces={spaces} onLookup={onLookup} onImport={onImport} onClose={noop} />);

    fireEvent.change(screen.getByPlaceholderText(/공유 코드/), { target: { value: "abcd2345" } });
    fireEvent.click(screen.getByRole("button", { name: /조회/ }));
    expect(onLookup).toHaveBeenCalledWith("ABCD2345"); // 대문자 정규화

    expect(await screen.findByText("공유 자료")).toBeInTheDocument();
    expect(screen.getByText(/링크 3개/)).toBeInTheDocument();
    expect(screen.getByText(/앨리스/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("개인"));
    fireEvent.click(screen.getByRole("button", { name: /가져오기/ }));
    await waitFor(() => expect(onImport).toHaveBeenCalledWith("ABCD2345", "s1"));
  });

  it("조회 실패 시 에러 메시지를 보여준다", async () => {
    const onLookup = vi.fn().mockRejectedValue(new Error("not found"));
    render(<ImportCodeDialog open spaces={spaces} onLookup={onLookup} onImport={vi.fn()} onClose={noop} />);
    fireEvent.change(screen.getByPlaceholderText(/공유 코드/), { target: { value: "BADBAD22" } });
    fireEvent.click(screen.getByRole("button", { name: /조회/ }));
    expect(await screen.findByText(/찾을 수 없거나 만료된 코드/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @tablign/ui test`
Expected: FAIL — 신규 모듈 없음 + 메뉴 신규 케이스 실패

- [ ] **Step 3: 구현**

`CollectionMoreMenu.tsx` 수정 — props에 `onShare?: () => void` 추가, 루트 메뉴 렌더를:

```tsx
          {mode === null ? (
            <>
              {spaces.length > 0 && (
                <>
                  <button type="button" style={itemStyle} onClick={() => setMode("move")}>다른 스페이스로 이동</button>
                  <button type="button" style={itemStyle} onClick={() => setMode("copy")}>다른 스페이스에 복사</button>
                </>
              )}
              {onShare && (
                <button type="button" style={itemStyle} onClick={() => { onShare(); close(); }}>공유 코드</button>
              )}
            </>
          ) : (
```

`packages/ui/src/ShareCodeDialog.tsx` 생성 (`ConfirmDialog`의 오버레이 패턴 재사용):

```tsx
import { useEffect } from "react";
import { theme } from "./theme";
import { Button } from "./Button";

export interface ShareCodeDialogProps {
  open: boolean;
  collectionTitle: string;
  /** null이면 만료 선택 화면, 값이 있으면 코드 표시 화면 */
  issued: { code: string; expires_at: string | null } | null;
  onIssue: (expiresInDays: number | null) => void;
  onRevoke: () => void;
  onClose: () => void;
}

/** 컬렉션 공유 코드 발급·표시 다이얼로그. */
export function ShareCodeDialog({ open, collectionTitle, issued, onIssue, onRevoke, onClose }: ShareCodeDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div role="presentation" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <div role="dialog" aria-modal="true" aria-label="컬렉션 공유 코드" onClick={(e) => e.stopPropagation()}
        style={{ width: 340, maxWidth: "calc(100vw - 32px)", background: theme.surface, borderRadius: 12, padding: "20px 20px 16px", boxShadow: "0 12px 40px rgba(0,0,0,.22)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>‘{collectionTitle}’ 공유 코드</div>
        {issued === null ? (
          <>
            <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: theme.textMuted }}>
              코드를 받은 사람은 이 컬렉션을 자기 스페이스로 복사해 갈 수 있어요.
            </p>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button variant="outline" onClick={() => onIssue(null)}>무기한 코드 만들기</Button>
              <Button onClick={() => onIssue(7)}>7일 코드 만들기</Button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <code style={{ flex: 1, textAlign: "center", fontSize: 22, fontWeight: 800, letterSpacing: "0.18em", padding: "10px 0", background: theme.surface2, borderRadius: 9, color: theme.text }}>
                {issued.code}
              </code>
              <Button onClick={() => navigator.clipboard?.writeText(issued.code)}>복사</Button>
            </div>
            <p style={{ marginTop: 8, fontSize: 12, color: theme.textFaint }}>
              {issued.expires_at
                ? `${new Date(issued.expires_at).toLocaleDateString()}까지 사용할 수 있어요.`
                : "무기한 코드예요. 더 이상 공유하지 않으려면 회수하세요."}
            </p>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between" }}>
              <Button variant="outline" style={{ color: theme.danger }} onClick={onRevoke}>회수</Button>
              <Button variant="outline" onClick={onClose}>닫기</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

`packages/ui/src/ImportCodeDialog.tsx` 생성:

```tsx
import { useEffect, useState } from "react";
import { theme } from "./theme";
import { Button } from "./Button";
import type { SpaceOption } from "./CollectionMoreMenu";

export interface ImportCodeInfo { title: string; icon: string | null; link_count: number; shared_by: string | null }

export interface ImportCodeDialogProps {
  open: boolean;
  spaces: SpaceOption[];
  onLookup: (code: string) => Promise<ImportCodeInfo>;
  onImport: (code: string, spaceId: string) => Promise<void>;
  onClose: () => void;
}

/** 공유 코드 입력 → 미리보기 → 대상 스페이스 선택 → 가져오기 다이얼로그. */
export function ImportCodeDialog({ open, spaces, onLookup, onImport, onClose }: ImportCodeDialogProps) {
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<ImportCodeInfo | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 닫힐 때 상태 초기화
  useEffect(() => {
    if (!open) { setCode(""); setInfo(null); setSpaceId(null); setError(null); setBusy(false); }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const normalized = code.trim().toUpperCase();

  async function lookup() {
    setError(null); setBusy(true);
    try {
      setInfo(await onLookup(normalized));
    } catch {
      setInfo(null);
      setError("찾을 수 없거나 만료된 코드예요.");
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    if (!spaceId) return;
    setBusy(true);
    try {
      await onImport(normalized, spaceId);
      onClose();
    } catch {
      setError("가져오지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return (
    <div role="presentation" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <div role="dialog" aria-modal="true" aria-label="코드로 가져오기" onClick={(e) => e.stopPropagation()}
        style={{ width: 340, maxWidth: "calc(100vw - 32px)", background: theme.surface, borderRadius: 12, padding: "20px 20px 16px", boxShadow: "0 12px 40px rgba(0,0,0,.22)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>코드로 가져오기</div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="공유 코드 8자리"
            maxLength={8}
            style={{ flex: 1, padding: "8px 10px", border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", outline: "none", boxSizing: "border-box" }}
          />
          <Button onClick={lookup} disabled={busy || normalized.length !== 8}>조회</Button>
        </div>
        {error && <p style={{ marginTop: 8, fontSize: 12.5, color: theme.danger }}>{error}</p>}
        {info && (
          <>
            <div style={{ marginTop: 12, padding: "10px 12px", background: theme.surface2, borderRadius: 9 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: theme.text }}>
                {info.icon ? `${info.icon} ` : ""}{info.title}
              </div>
              <div style={{ marginTop: 3, fontSize: 12, color: theme.textMuted }}>
                링크 {info.link_count}개{info.shared_by ? ` · ${info.shared_by}님이 공유` : ""}
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: theme.textFaint }}>가져올 스페이스</div>
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {spaces.map((s) => (
                <button key={s.id} type="button" onClick={() => setSpaceId(s.id)}
                  style={{
                    border: `1px solid ${spaceId === s.id ? theme.accent : theme.border}`,
                    background: spaceId === s.id ? theme.accentWeak : theme.surface,
                    color: spaceId === s.id ? theme.accent : theme.text,
                    borderRadius: 8, padding: "5px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  }}>
                  {s.icon ? `${s.icon} ` : ""}{s.name}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button variant="outline" onClick={onClose}>취소</Button>
              <Button onClick={doImport} disabled={busy || !spaceId}>가져오기</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

`packages/ui/src/index.ts`에 두 줄 추가:

```typescript
export * from "./ShareCodeDialog";
export * from "./ImportCodeDialog";
```

- [ ] **Step 4: 테스트·린트 통과 확인**

Run: `pnpm --filter @tablign/ui test && pnpm --filter @tablign/ui lint`
Expected: 전부 PASS (신규 7케이스 포함)

- [ ] **Step 5: 커밋**

```bash
git add packages/ui/src/CollectionMoreMenu.tsx packages/ui/src/ShareCodeDialog.tsx packages/ui/src/ImportCodeDialog.tsx packages/ui/src/index.ts packages/ui/src/__tests__/
git commit -m "feat(ui): 공유 코드 발급·가져오기 다이얼로그 및 메뉴 항목"
```

---

### Task 5: 확장 연결 — NewTab + 사이드바 진입점

**Files:**
- Modify: `apps/extension/src/newtab/NewTab.tsx`
- Modify: `apps/extension/src/newtab/ExtSidebar.tsx`

**Interfaces:**
- Consumes: Task 3의 core 함수 4종, Task 4의 다이얼로그·메뉴 prop, 기존 `useToast`(ToastProvider는 main.tsx에 이미 마운트됨)
- Produces: 사용자 기능 완성

- [ ] **Step 1: ExtSidebar에 "코드로 가져오기" 진입점 추가**

`ExtSidebarProps`에 `onImportCode: () => void;` 추가. 하단 로그아웃 줄(121행 부근, `title="로그아웃"` 버튼이 있는 행) **위에** 다음 버튼 행 추가 (기존 스페이스 행 버튼과 같은 스타일 관례를 따른다. `Download` 아이콘은 이미 `@tablign/ui` icons에 export됨):

```tsx
      <button
        type="button"
        onClick={onImportCode}
        style={{
          display: "flex", alignItems: "center", gap: 7, width: "100%",
          border: "none", background: "none", cursor: "pointer",
          padding: "7px 9px", borderRadius: 8, fontSize: 12.5, color: theme.textMuted,
        }}
      >
        <Download size={14} /> 코드로 가져오기
      </button>
```

import에 `Download` 추가, `ExtSidebar` 구조 분해에 `onImportCode` 추가.

- [ ] **Step 2: NewTab에 상태·핸들러·다이얼로그 연결**

import 추가: `@tablign/core`에 `createCollectionShareCode, revokeCollectionShareCode, getShareCodeInfo, importCollectionByCode, type ShareCode`, `@tablign/ui`에 `ShareCodeDialog, ImportCodeDialog`.

`NewTab` 본문(기존 `copyCollectionTo` 근처)에 추가:

```tsx
  // 공유 코드: 발급 다이얼로그 대상 컬렉션과 발급 결과
  const [shareTarget, setShareTarget] = useState<Collection | null>(null);
  const [issuedCode, setIssuedCode] = useState<ShareCode | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  async function openShareDialog(collection: Collection) {
    setShareTarget(collection);
    setIssuedCode(null);
    // 이미 활성 코드가 있으면 기본 7일 발급 호출이 그 코드를 그대로 반환한다 → 바로 코드 화면
    // (없으면 사용자가 만료를 고르도록 선택 화면 유지)
    try {
      const { data } = await supabase
        .from("collection_share_codes")
        .select("code, expires_at")
        .eq("collection_id", collection.id)
        .is("revoked_at", null)
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString());
      if (data && data.length > 0) setIssuedCode(data[0] as ShareCode);
    } catch (e) {
      console.error(e);
    }
  }

  async function issueShareCode(expiresInDays: number | null) {
    if (!shareTarget) return;
    try {
      setIssuedCode(await createCollectionShareCode(supabase, shareTarget.id, expiresInDays));
    } catch (e) {
      console.error(e);
      toast.show("코드를 만들지 못했어요. 다시 시도해 주세요.");
    }
  }

  async function revokeShareCode() {
    if (!issuedCode) return;
    try {
      await revokeCollectionShareCode(supabase, issuedCode.code);
      toast.show("공유 코드를 회수했어요");
      setShareTarget(null);
    } catch (e) {
      console.error(e);
      toast.show("회수하지 못했어요. 다시 시도해 주세요.");
    }
  }

  async function importByCode(code: string, targetSpaceId: string) {
    await importCollectionByCode(supabase, code, targetSpaceId);
    const name = spaces.find((s) => s.id === targetSpaceId)?.name ?? "";
    toast.show(`'${name}' 스페이스로 가져왔어요`);
    // 가져온 스페이스로 이동해 결과를 바로 보여준다
    setActiveSpaceId(targetSpaceId);
  }
```

`CollectionSection`의 `moreMenuSlot`을 수정 — 기존 "다른 스페이스 있음" 조건을 없애고 항상 렌더(공유는 스페이스 1개여도 가능):

```tsx
  moreMenuSlot={
    <CollectionMoreMenu
      spaces={spaces
        .filter((s) => s.id !== activeSpaceId)
        .map((s) => ({ id: s.id, name: s.name, icon: s.icon }))}
      onMove={(sid) => moveCollectionTo(c, sid)}
      onCopy={(sid) => copyCollectionTo(c, sid)}
      onShare={() => openShareDialog(c)}
    />
  }
```

`ExtSidebar`에 `onImportCode={() => setImportOpen(true)}` 전달.

JSX 최하단(`</DndContext>` 직전, `<DragOverlay>` 뒤)에 다이얼로그 렌더:

```tsx
      <ShareCodeDialog
        open={shareTarget !== null}
        collectionTitle={shareTarget?.title ?? ""}
        issued={issuedCode}
        onIssue={issueShareCode}
        onRevoke={revokeShareCode}
        onClose={() => setShareTarget(null)}
      />
      <ImportCodeDialog
        open={importOpen}
        spaces={spaces.map((s) => ({ id: s.id, name: s.name, icon: s.icon }))}
        onLookup={(code) => getShareCodeInfo(supabase, code)}
        onImport={importByCode}
        onClose={() => setImportOpen(false)}
      />
```

- [ ] **Step 3: 타입·테스트·빌드 확인**

Run: `pnpm --filter @tablign/extension lint && pnpm --filter @tablign/extension test && pnpm --filter @tablign/extension build`
Expected: 전부 통과 (NewTab.test.tsx의 `@tablign/core` 목킹은 `importOriginal` 스프레드 방식이라 신규 함수가 실제 모듈에서 로드됨 — 온보딩 테스트에는 영향 없음. 만약 렌더 시 `collection_share_codes` 조회 등으로 실패하면, 목의 스프레드 뒤에 신규 함수 4종도 `vi.fn()`으로 추가)

Run: `pnpm test` (루트)
Expected: 전부 PASS

- [ ] **Step 4: 수동 검증 (크롬에서)**

1. `pnpm --filter @tablign/extension build` 후 `chrome://extensions` dist 재로드
2. 컬렉션 ⋯ → "공유 코드" → 7일/무기한 선택 → 코드 표시·복사 확인
3. 같은 컬렉션에서 다시 열면 기존 코드가 바로 표시되는지, "회수" 후 재발급 시 새 코드인지
4. (다른 계정 또는 같은 계정) 사이드바 "코드로 가져오기" → 코드 입력 → 미리보기(이름·링크 수·공유자) → 스페이스 선택 → 가져오기 → 해당 스페이스로 전환되고 복사본 확인
5. 회수/만료 코드 입력 시 "찾을 수 없거나 만료된 코드예요" 확인

- [ ] **Step 5: 커밋**

```bash
git add apps/extension/src/newtab/NewTab.tsx apps/extension/src/newtab/ExtSidebar.tsx
git commit -m "feat(extension): 공유 코드 발급·가져오기 연결"
```
