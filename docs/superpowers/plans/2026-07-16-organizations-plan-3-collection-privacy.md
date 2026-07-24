# 컬렉션 비공개(Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 컬렉션을 "비공개"로 지정하면 권한(owner/admin 포함)과 무관하게 **생성자 본인만** 열람·편집할 수 있게 한다. 스페이스 목록·컬렉션 헤더에 🔒로 표시한다.

**Architecture:** `collections.is_private` 컬럼 하나를 추가하고, 기존 `has_collection_access`/`can_edit_collection`(0010) 판정 함수에 **비공개 오버레이**를 얹는다: `is_private`면 `user_id = auth.uid()` 인 경우만, 아니면 기존 스페이스 기준. `links` 정책은 이미 이 두 함수에 위임하므로 비공개가 자동 상속된다. 토글은 생성자만(UI 게이트).

**Tech Stack:** Supabase(Postgres + RLS), TypeScript(`@tablign/core`), React(`@tablign/ui` CollectionMoreMenu/CollectionSection, 익스텐션 새 탭), Vitest.

## Global Constraints

- 커밋 컨벤션: `[타입] 명사형` Korean; `feat(scope):` 금지.
- 마이그레이션 번호: Phase 2가 `0019`까지 썼으므로 `0020`부터.
- **테스트 DB는 로컬**(`packages/core/.env.test` → `http://127.0.0.1:54321`). 새 마이그레이션은 **로컬(`supabase migration up --local`) + 원격(`supabase db push`, ref `njteyuixwdsclsrpcvqt`) 둘 다** 적용. 스키마 캐시 지연 시 `NOTIFY pgrst, 'reload schema';`.
- 비공개 판정: `is_private`면 `collections.user_id = auth.uid()`(생성자)만 접근·편집. owner/admin이라도 남의 비공개 컬렉션은 못 봄.
- 비공개 토글은 **생성자만**(UI 1차 방어선: `collection.user_id === 내 id`일 때만 메뉴 노출). RLS는 최종 방어선.
- 🔒 아이콘은 lucide `Lock`(이미 프로젝트에서 사용) 또는 `@tablign/ui` 아이콘 export 사용.
- 테두리 있는 요소엔 `boxSizing:"border-box"`.

---

### Task 1: collections.is_private + 판정 함수 비공개 오버레이

**Files:**
- Create: `supabase/migrations/0020_collection_privacy.sql`
- Modify: `packages/core/src/__tests__/rls.test.ts` 또는 신규 describe (아래는 org.test.ts에 추가)

**Interfaces:**
- Consumes: `has_space_access`/`can_edit_space`(0016), `collections`(0001).
- Produces: `collections.is_private boolean not null default false`; 재작성된 `has_collection_access`/`can_edit_collection`.

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/0020_collection_privacy.sql`:

```sql
-- 컬렉션 단위 비공개: is_private면 생성자(user_id)만 접근·편집. 아니면 기존 스페이스 기준.

alter table public.collections add column is_private boolean not null default false;

-- 판정 함수에 비공개 오버레이 (0010 정의를 대체)
create or replace function public.has_collection_access(p_collection_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from collections c
      where c.id = p_collection_id
        and (case when c.is_private then c.user_id = auth.uid()
                  else public.has_space_access(c.space_id) end)
    );
$$;

create or replace function public.can_edit_collection(p_collection_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from collections c
      where c.id = p_collection_id
        and (case when c.is_private then c.user_id = auth.uid()
                  else public.can_edit_space(c.space_id) end)
    );
$$;
```

> `collections` select/update/delete 정책(0011)은 `has_space_access`/`can_edit_space`를 직접 쓴다. 비공개 컬렉션의 select도 막으려면 그 정책도 봐야 한다. **`collections_select`(0011)는 `has_space_access(space_id)`** 이므로 비공개 오버레이가 적용되지 않는다 → 아래 Step 2에서 `collections` 정책을 비공개 인지하도록 교체한다.

- [ ] **Step 2: collections 정책을 비공개 인지하도록 교체 (같은 마이그레이션에 이어서)**

Append to `0020_collection_privacy.sql`:

```sql
-- collections 정책: 비공개면 생성자만 보이고/편집. (링크는 has_collection_access/can_edit_collection에
-- 위임하므로 자동 상속.)
drop policy "collections_select" on public.collections;
create policy "collections_select" on public.collections
  for select using (
    case when is_private then user_id = auth.uid()
         else public.has_space_access(space_id) end
  );

drop policy "collections_update" on public.collections;
create policy "collections_update" on public.collections
  for update using (
    case when is_private then user_id = auth.uid() else public.has_space_access(space_id) end
  ) with check (
    case when is_private then user_id = auth.uid() else public.can_edit_space(space_id) end
  );

drop policy "collections_delete" on public.collections;
create policy "collections_delete" on public.collections
  for delete using (
    case when is_private then user_id = auth.uid() else public.can_edit_space(space_id) end
  );
-- collections_insert(0011)은 그대로: 생성 시 can_edit_space + user_id=auth.uid(). 생성 후 토글로 비공개 전환.
```

> 주의: `collections_update` USING에 `has_space_access`(보기 권한)를 쓰되 WITH CHECK에 편집 권한을 쓰는 0011 패턴을 유지하면, 비공개 토글 시점에 문제가 된다. 비공개는 생성자만이므로 USING/WITH CHECK 모두 생성자(`user_id=auth.uid()`)로 두면 토글·수정이 일관된다. 위 SQL이 그 형태다.

- [ ] **Step 3: 로컬+원격 적용** — `supabase migration up --local` && `supabase db push`.

- [ ] **Step 4: 실패하는 테스트 작성** — Append to `packages/core/src/__tests__/org.test.ts` (팀 조직 `orgId`, 멤버 `adminMember` 재사용):

```ts
describe("컬렉션 비공개", () => {
  let teamSpace: string;
  let privColl: string;
  beforeAll(async () => {
    await admin.from("organization_members").upsert({ org_id: orgId, user_id: adminMember.id, role: "admin" });
    const { data: s } = await owner.client.from("spaces").insert({ user_id: owner.id, name: "비공개 테스트", org_id: orgId }).select().single();
    teamSpace = s!.id;
    const { data: c } = await owner.client.from("collections").insert({ user_id: owner.id, space_id: teamSpace, title: "오너 비공개", is_private: true }).select().single();
    privColl = c!.id;
  });
  it("생성자는 자기 비공개 컬렉션을 본다", async () => {
    expect((await owner.client.from("collections").select().eq("id", privColl)).data!.length).toBe(1);
  });
  it("같은 조직 admin이라도 남의 비공개 컬렉션은 못 본다", async () => {
    expect((await adminMember.client.from("collections").select().eq("id", privColl)).data!.length).toBe(0);
  });
  it("admin은 남의 비공개 컬렉션을 수정할 수 없다", async () => {
    await adminMember.client.from("collections").update({ title: "탈취" }).eq("id", privColl);
    expect((await admin.from("collections").select("title").eq("id", privColl).single()).data!.title).toBe("오너 비공개");
  });
  it("비공개 컬렉션의 링크도 생성자만 본다", async () => {
    const { data: l } = await owner.client.from("links").insert({ user_id: owner.id, collection_id: privColl, url: "https://p.com", title: "P", position: 1000 }).select().single();
    expect((await owner.client.from("links").select().eq("id", l!.id)).data!.length).toBe(1);
    expect((await adminMember.client.from("links").select().eq("id", l!.id)).data!.length).toBe(0);
  });
  it("공개 컬렉션은 조직 멤버가 정상적으로 본다(회귀)", async () => {
    const { data: pub } = await owner.client.from("collections").insert({ user_id: owner.id, space_id: teamSpace, title: "공개" }).select().single();
    expect((await adminMember.client.from("collections").select().eq("id", pub!.id)).data!.length).toBe(1);
  });
});
```

- [ ] **Step 5: 테스트 실행** — `pnpm --filter @tablign/core test org.test.ts` (PASS) + `pnpm --filter @tablign/core test share-space.test.ts rls.test.ts` (회귀 PASS — 비공개 기본 false라 기존 동작 불변).

- [ ] **Step 6: 커밋**
```bash
git add supabase/migrations/0020_collection_privacy.sql packages/core/src/__tests__/org.test.ts
git commit -m "[기능] 컬렉션 비공개 RLS 오버레이"
```

---

### Task 2: core 타입·데이터 계층 (is_private)

**Files:**
- Modify: `packages/core/src/types.ts` (`Collection`에 `is_private`)
- Modify: `packages/core/src/data/collections.ts` (`updateCollection` patch + `CreateCollectionInput`에 선택적 `is_private`)
- Modify: `packages/core/src/__tests__/org.test.ts`

**Interfaces:**
- Produces: `Collection.is_private: boolean`; `updateCollection` patch가 `is_private` 포함; `setCollectionPrivate(client, id, isPrivate): Promise<void>` (선택적 편의 — 또는 updateCollection 재사용).

- [ ] **Step 1: 타입** — `packages/core/src/types.ts`의 `Collection`에 `is_private: boolean;` 추가(예: `note` 다음).

- [ ] **Step 2: collections.ts** — `updateCollection`의 patch 타입을 `Partial<Pick<Collection, "title" | "icon" | "note" | "position" | "space_id" | "is_private">>`로 확장. (`CreateCollectionInput`이 있으면 `is_private?: boolean` 추가; 없으면 스킵.)

- [ ] **Step 3: 테스트** — Append to `org.test.ts`:
```ts
import { updateCollection } from "../data/collections";
```
```ts
describe("컬렉션 비공개 데이터 계층", () => {
  it("updateCollection으로 비공개 토글", async () => {
    const { data: c } = await owner.client.from("collections").insert({ user_id: owner.id, space_id: (await owner.client.from("spaces").insert({ user_id: owner.id, name: "토글s", org_id: orgId }).select().single()).data!.id, title: "토글" }).select().single();
    await updateCollection(owner.client, c!.id, { is_private: true });
    expect((await admin.from("collections").select("is_private").eq("id", c!.id).single()).data!.is_private).toBe(true);
    await updateCollection(owner.client, c!.id, { is_private: false });
    expect((await admin.from("collections").select("is_private").eq("id", c!.id).single()).data!.is_private).toBe(false);
  });
});
```

- [ ] **Step 4: 테스트 + 타입체크** — `pnpm --filter @tablign/core test org.test.ts` + `pnpm --filter @tablign/core lint`.

- [ ] **Step 5: 커밋**
```bash
git add packages/core/src/types.ts packages/core/src/data/collections.ts packages/core/src/__tests__/org.test.ts
git commit -m "[기능] 컬렉션 is_private 타입·데이터 계층"
```

---

### Task 3: 비공개 토글 UI + 🔒 표시

**Files:**
- Modify: `packages/ui/src/CollectionMoreMenu.tsx`
- Modify: `packages/ui/src/CollectionSection.tsx` (🔒 표시)
- Modify: `apps/extension/src/newtab/NewTab.tsx`
- Modify: `apps/extension/src/newtab/NewTab.test.tsx`

**Interfaces:**
- Produces (CollectionMoreMenu): props에 `isPrivate?: boolean`, `onTogglePrivate?: () => void` 추가. `onTogglePrivate`가 있을 때만 메뉴에 "비공개로 전환"/"공개로 전환" 항목 렌더.
- Produces (CollectionSection): prop `isPrivate?: boolean` 추가 — true면 제목 옆에 🔒 표시.

- [ ] **Step 1: CollectionMoreMenu에 토글 항목**

Modify `packages/ui/src/CollectionMoreMenu.tsx`:
```ts
export interface CollectionMoreMenuProps {
  spaces: SpaceOption[];
  onMove: (spaceId: string) => void;
  onCopy: (spaceId: string) => void;
  onShare?: () => void;
  isPrivate?: boolean;
  onTogglePrivate?: () => void;
}
```
- In the menu's root list, when `onTogglePrivate` is provided, add a menu item labeled `isPrivate ? "공개로 전환" : "비공개로 전환"` that calls `onTogglePrivate()` then `close()`. Follow the existing menu-item style (same as the onShare item).

- [ ] **Step 2: CollectionSection에 🔒 표시**

Modify `packages/ui/src/CollectionSection.tsx`:
- Add `isPrivate?: boolean` to its props.
- Render a small `Lock` icon (import `Lock` from `./icons` — add `Lock` to the lucide re-export list in `packages/ui/src/icons.ts` if missing, `grep -n "Lock" packages/ui/src/icons.ts`) next to the collection title when `isPrivate` is true, colored `theme.textFaint`, `boxSizing:"border-box"` on any wrapper.

- [ ] **Step 3: NewTab 배선**

Modify `apps/extension/src/newtab/NewTab.tsx`:
- Where `CollectionMoreMenu` is rendered (inside the collections map), pass `isPrivate={c.is_private}` and — only when the current user is the creator (`c.user_id === userId`) — `onTogglePrivate={async () => { await updateCollection(supabase, c.id, { is_private: !c.is_private }); loadCollections(); }}`. When not the creator, omit `onTogglePrivate` (no toggle item).
- Pass `isPrivate={c.is_private}` to `CollectionSection`.
- `updateCollection` is already imported.

- [ ] **Step 4: 빌드 + 회귀 테스트**
- `pnpm --filter @tablign/ui lint` + `pnpm --filter @tablign/extension build` → clean.
- `pnpm --filter @tablign/extension test NewTab.test.tsx` → green (mock collections may need `is_private: false` added; add if a filter/render needs it).

- [ ] **Step 5: 커밋**
```bash
git add packages/ui/src/CollectionMoreMenu.tsx packages/ui/src/CollectionSection.tsx packages/ui/src/icons.ts apps/extension/src/newtab/NewTab.tsx apps/extension/src/newtab/NewTab.test.tsx
git commit -m "[기능] 컬렉션 비공개 토글·표시 UI"
```

---

## Self-Review

**Spec coverage (스펙 §2 `collections.is_private`, §4 비공개 오버레이, §6 토글·🔒):**
- is_private 컬럼 + 판정 오버레이 → Task 1
- collections select/update/delete 정책 비공개 인지 → Task 1 Step 2 (중요 — 판정 함수만 고치면 collections_select가 여전히 has_space_access라 비공개가 안 숨겨짐)
- 타입·데이터 계층 → Task 2
- 토글 UI(생성자만)·🔒 → Task 3

**Placeholder scan:** 구체 SQL·TS·TSX 포함. Task 3은 기존 CollectionMoreMenu/CollectionSection 구조 의존부를 "기존 스타일 따라 항목 추가"로 안내(주변 코드 매칭).

**Type consistency:** `Collection.is_private`(Task 2)가 Task 3 UI(`c.is_private`)·Task 1 테스트(`is_private: true` insert)와 일치. `updateCollection` patch 확장이 Task 2 정의와 Task 3 호출에서 일치.

**주의(실행 시):**
- 판정 함수 오버레이만으로는 부족 — `collections_select`(0011)가 `has_space_access` 직접 호출이므로 비공개 컬렉션 목록이 노출된다. Task 1 Step 2에서 collections 정책 자체를 비공개 인지형으로 교체하는 게 핵심.
- 링크는 `has_collection_access`/`can_edit_collection`에 위임하므로 자동 상속(테스트로 확인).
- 비공개 토글은 생성자만 — 비생성자(admin)가 남의 공개 컬렉션을 비공개로 만들어 자기를 잠그는 footgun을 UI 게이트로 차단. (DB 레벨 "is_private는 생성자만 설정" 가드는 MVP 제외, 필요 시 후속.)
