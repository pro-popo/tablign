# tablign Plan 3 — 태그 · 검색 · Realtime 동기화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 컬렉션에 태그를 달고 태그로 필터링하고, 컬렉션·링크를 검색하고, 한 디바이스의 변경이 다른 디바이스/탭에 자동 반영(Realtime)되게 한다.

**Architecture:** 태그/검색 데이터 접근은 `@tablign/core/src/data/*`에 순수 함수로 추가하고 로컬 Supabase 통합 테스트로 검증한다. Realtime은 Supabase의 `postgres_changes` 구독으로 처리하며, 변경 수신 시 TanStack Query 캐시를 무효화한다. 대상 테이블을 `supabase_realtime` 퍼블리케이션에 추가하는 마이그레이션이 필요하다.

**Tech Stack:** TypeScript, Supabase JS(Realtime 포함), Vitest, React 18, Next.js 15, TanStack Query.

**Prerequisites:** Plan 1·2 완료(core 데이터 계층, `@tablign/ui`, 웹 대시보드, TanStack Query). 로컬 Supabase 실행 중. `packages/core/.env.test` 존재.

---

## File Structure

```
packages/core/src/
├── data/
│   ├── tags.ts          # 태그 + collection_tags 데이터 접근
│   └── search.ts        # 컬렉션/링크 검색
├── index.ts             # (수정) 재export
└── __tests__/
    └── data.test.ts     # (수정) tags/search describe 추가

supabase/migrations/
└── 0003_realtime.sql    # 테이블을 realtime 퍼블리케이션에 추가

apps/web/src/
├── lib/
│   ├── queries.ts        # (수정) 태그/검색 훅 추가
│   └── useRealtimeSync.ts # Realtime 구독 → 캐시 무효화 훅
└── app/dashboard/
    ├── DashboardClient.tsx # (수정) 검색바·태그필터·Realtime 연결
    ├── SearchBar.tsx        # 검색 입력 + 결과 표시
    └── TagBar.tsx           # 컬렉션 태그 칩 + 태그 추가/필터
```

---

## Task 1: 태그 데이터 접근 (TDD)

**Files:**
- Create: `packages/core/src/data/tags.ts`
- Modify: `packages/core/src/__tests__/data.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: data.test.ts에 import + describe 추가**

상단 `../data/*` import 근처에 추가:

```typescript
import {
  listTags,
  createTag,
  deleteTag,
  addTagToCollection,
  removeTagFromCollection,
  listTagsForCollection,
  listCollectionIdsForTag,
} from "../data/tags";
```

파일 끝에 추가:

```typescript
describe("tags 데이터 접근", () => {
  let user: { client: SupabaseClient; id: string };
  let collectionId: string;

  beforeAll(async () => {
    user = await makeUser(`tags-${Date.now()}@test.local`);
    const space = await createSpace(user.client, { user_id: user.id, name: "개인" });
    const c = await createCollection(user.client, {
      user_id: user.id,
      space_id: space.id,
      title: "C",
    });
    collectionId = c.id;
  });

  it("태그를 만들고 목록에 나타난다", async () => {
    const tag = await createTag(user.client, { user_id: user.id, name: "디자인" });
    expect(tag.name).toBe("디자인");
    const list = await listTags(user.client);
    expect(list.some((t) => t.id === tag.id)).toBe(true);
  });

  it("컬렉션에 태그를 달고 컬렉션의 태그 목록에 나타난다", async () => {
    const tag = await createTag(user.client, { user_id: user.id, name: "읽을거리" });
    await addTagToCollection(user.client, collectionId, tag.id);
    const tags = await listTagsForCollection(user.client, collectionId);
    expect(tags.some((t) => t.id === tag.id)).toBe(true);
  });

  it("태그로 컬렉션 id를 조회한다", async () => {
    const tag = await createTag(user.client, { user_id: user.id, name: "필터용" });
    await addTagToCollection(user.client, collectionId, tag.id);
    const ids = await listCollectionIdsForTag(user.client, tag.id);
    expect(ids).toContain(collectionId);
  });

  it("컬렉션에서 태그를 제거한다", async () => {
    const tag = await createTag(user.client, { user_id: user.id, name: "제거대상" });
    await addTagToCollection(user.client, collectionId, tag.id);
    await removeTagFromCollection(user.client, collectionId, tag.id);
    const tags = await listTagsForCollection(user.client, collectionId);
    expect(tags.some((t) => t.id === tag.id)).toBe(false);
  });

  it("태그를 삭제한다", async () => {
    const tag = await createTag(user.client, { user_id: user.id, name: "삭제대상" });
    await deleteTag(user.client, tag.id);
    const list = await listTags(user.client);
    expect(list.some((t) => t.id === tag.id)).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `pnpm --filter @tablign/core test data`
Expected: FAIL — `../data/tags` 없음.

- [ ] **Step 3: 구현 작성**

Create `packages/core/src/data/tags.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tag } from "../types";

export interface CreateTagInput {
  user_id: string;
  name: string;
  color?: string | null;
}

export async function listTags(client: SupabaseClient): Promise<Tag[]> {
  const { data, error } = await client.from("tags").select().order("name", { ascending: true });
  if (error) throw error;
  return data as Tag[];
}

export async function createTag(
  client: SupabaseClient,
  input: CreateTagInput,
): Promise<Tag> {
  const { data, error } = await client.from("tags").insert(input).select().single();
  if (error) throw error;
  return data as Tag;
}

export async function deleteTag(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("tags").delete().eq("id", id);
  if (error) throw error;
}

export async function addTagToCollection(
  client: SupabaseClient,
  collectionId: string,
  tagId: string,
): Promise<void> {
  const { error } = await client
    .from("collection_tags")
    .insert({ collection_id: collectionId, tag_id: tagId });
  if (error) throw error;
}

export async function removeTagFromCollection(
  client: SupabaseClient,
  collectionId: string,
  tagId: string,
): Promise<void> {
  const { error } = await client
    .from("collection_tags")
    .delete()
    .eq("collection_id", collectionId)
    .eq("tag_id", tagId);
  if (error) throw error;
}

export async function listTagsForCollection(
  client: SupabaseClient,
  collectionId: string,
): Promise<Tag[]> {
  const { data, error } = await client
    .from("collection_tags")
    .select("tags(*)")
    .eq("collection_id", collectionId);
  if (error) throw error;
  // data: [{ tags: Tag }] 형태
  return (data ?? []).map((row: { tags: Tag }) => row.tags).filter(Boolean);
}

export async function listCollectionIdsForTag(
  client: SupabaseClient,
  tagId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("collection_tags")
    .select("collection_id")
    .eq("tag_id", tagId);
  if (error) throw error;
  return (data ?? []).map((row: { collection_id: string }) => row.collection_id);
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `pnpm --filter @tablign/core test data`
Expected: 기존 + 태그 5 테스트 모두 PASS.

- [ ] **Step 5: index.ts에 재export**

```typescript
export * from "./data/tags";
```

- [ ] **Step 6: 커밋**

```bash
git add packages/core/src/data/tags.ts packages/core/src/__tests__/data.test.ts packages/core/src/index.ts
git commit -m "feat(core): 태그 데이터 접근 함수 추가"
```

---

## Task 2: 검색 데이터 접근 (TDD)

**Files:**
- Create: `packages/core/src/data/search.ts`
- Modify: `packages/core/src/__tests__/data.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: data.test.ts에 import + describe 추가**

import 추가:

```typescript
import { searchCollections, searchLinks } from "../data/search";
```

파일 끝에 추가:

```typescript
describe("search 데이터 접근", () => {
  let user: { client: SupabaseClient; id: string };

  beforeAll(async () => {
    user = await makeUser(`search-${Date.now()}@test.local`);
    const space = await createSpace(user.client, { user_id: user.id, name: "개인" });
    const c = await createCollection(user.client, {
      user_id: user.id,
      space_id: space.id,
      title: "리액트 자료",
    });
    await createLink(user.client, {
      user_id: user.id,
      collection_id: c.id,
      url: "https://nextjs.org/docs",
      title: "Next.js 문서",
    });
  });

  it("컬렉션 제목으로 검색한다", async () => {
    const results = await searchCollections(user.client, "리액트");
    expect(results.some((c) => c.title.includes("리액트"))).toBe(true);
  });

  it("링크 제목으로 검색한다", async () => {
    const results = await searchLinks(user.client, "Next.js");
    expect(results.some((l) => (l.title ?? "").includes("Next.js"))).toBe(true);
  });

  it("링크 url로 검색한다", async () => {
    const results = await searchLinks(user.client, "nextjs.org");
    expect(results.some((l) => l.url.includes("nextjs.org"))).toBe(true);
  });

  it("빈 쿼리는 빈 배열을 반환한다", async () => {
    expect(await searchCollections(user.client, "  ")).toEqual([]);
    expect(await searchLinks(user.client, "")).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `pnpm --filter @tablign/core test data`
Expected: FAIL — `../data/search` 없음.

- [ ] **Step 3: 구현 작성**

Create `packages/core/src/data/search.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection, Link } from "../types";

/** PostgREST or 필터에서 쓰는 특수문자를 제거해 안전하게 만든다 */
function sanitize(query: string): string {
  return query.trim().replace(/[%,()]/g, "");
}

export async function searchCollections(
  client: SupabaseClient,
  query: string,
): Promise<Collection[]> {
  const q = sanitize(query);
  if (!q) return [];
  const { data, error } = await client
    .from("collections")
    .select()
    .ilike("title", `%${q}%`)
    .limit(50);
  if (error) throw error;
  return data as Collection[];
}

export async function searchLinks(
  client: SupabaseClient,
  query: string,
): Promise<Link[]> {
  const q = sanitize(query);
  if (!q) return [];
  const { data, error } = await client
    .from("links")
    .select()
    .or(`title.ilike.%${q}%,custom_title.ilike.%${q}%,url.ilike.%${q}%`)
    .limit(50);
  if (error) throw error;
  return data as Link[];
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `pnpm --filter @tablign/core test`
Expected: 전체 PASS.

- [ ] **Step 5: index.ts에 재export + lint**

```typescript
export * from "./data/search";
```
Run: `pnpm --filter @tablign/core lint` — tsc PASS.

- [ ] **Step 6: 커밋**

```bash
git add packages/core/src/data/search.ts packages/core/src/__tests__/data.test.ts packages/core/src/index.ts
git commit -m "feat(core): 컬렉션/링크 검색 함수 추가"
```

---

## Task 3: Realtime 퍼블리케이션 마이그레이션

대상 테이블을 `supabase_realtime` 퍼블리케이션에 추가해 변경 이벤트를 받는다.

**Files:**
- Create: `supabase/migrations/0003_realtime.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/0003_realtime.sql`:

```sql
-- 대상 테이블을 realtime 퍼블리케이션에 추가 (이미 있으면 무시)
alter publication supabase_realtime add table public.spaces;
alter publication supabase_realtime add table public.collections;
alter publication supabase_realtime add table public.links;
alter publication supabase_realtime add table public.collection_tags;
```

- [ ] **Step 2: 적용**

Run: `pnpm dlx supabase migration up`
Expected: `0003_realtime` 적용 성공.
만약 "relation is already member of publication" 류 에러가 나면, 해당 테이블 줄을 빼고(이미 등록됨) 재적용한다.

- [ ] **Step 3: 확인**

Run: `pnpm dlx supabase migration list`
Expected: `0003_realtime` 적용됨.

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/0003_realtime.sql
git commit -m "feat(db): realtime 퍼블리케이션에 테이블 추가"
```

---

## Task 4: 웹 쿼리 훅 — 태그 + 검색

**Files:**
- Modify: `apps/web/src/lib/queries.ts`

- [ ] **Step 1: queries.ts에 태그/검색 import 추가**

상단 `@tablign/core` import 목록에 추가:

```typescript
  listTags,
  createTag,
  addTagToCollection,
  removeTagFromCollection,
  listTagsForCollection,
  listCollectionIdsForTag,
  searchCollections,
  searchLinks,
```

- [ ] **Step 2: 훅 추가 (파일 끝, `export { moveLink, ... }` 위)**

```typescript
export function useTags() {
  return useQuery({ queryKey: ["tags"], queryFn: () => listTags(supabase) });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { user_id: string; name: string }) => createTag(supabase, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useCollectionTags(collectionId: string) {
  return useQuery({
    queryKey: ["collection_tags", collectionId],
    queryFn: () => listTagsForCollection(supabase, collectionId),
  });
}

export function useAddTagToCollection(collectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => addTagToCollection(supabase, collectionId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collection_tags", collectionId] }),
  });
}

export function useRemoveTagFromCollection(collectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => removeTagFromCollection(supabase, collectionId, tagId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collection_tags", collectionId] }),
  });
}

export function useCollectionIdsForTag(tagId: string | null) {
  return useQuery({
    queryKey: ["tag_collections", tagId],
    queryFn: () => listCollectionIdsForTag(supabase, tagId!),
    enabled: !!tagId,
  });
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: async () => {
      const [collections, links] = await Promise.all([
        searchCollections(supabase, query),
        searchLinks(supabase, query),
      ]);
      return { collections, links };
    },
    enabled: query.trim().length > 0,
  });
}
```

- [ ] **Step 3: 빌드 확인**

Run: `pnpm --filter @tablign/web build`
Expected: 빌드 성공.

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/lib/queries.ts
git commit -m "feat(web): 태그/검색 쿼리 훅 추가"
```

---

## Task 5: Realtime 동기화 훅

**Files:**
- Create: `apps/web/src/lib/useRealtimeSync.ts`
- Modify: `apps/web/src/app/dashboard/DashboardClient.tsx` (훅 호출)

- [ ] **Step 1: 훅 작성**

Create `apps/web/src/lib/useRealtimeSync.ts`:

```typescript
"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "./queries";

/**
 * spaces/collections/links/collection_tags 변경을 구독해
 * 관련 TanStack Query 캐시를 무효화한다. (멀티 디바이스/탭 동기화)
 */
export function useRealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("tablign-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "spaces" }, () =>
        qc.invalidateQueries({ queryKey: ["spaces"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "collections" }, () =>
        qc.invalidateQueries({ queryKey: ["collections"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "links" }, () =>
        qc.invalidateQueries({ queryKey: ["links"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "collection_tags" }, () =>
        qc.invalidateQueries({ queryKey: ["collection_tags"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
```

- [ ] **Step 2: DashboardClient에서 호출**

`apps/web/src/app/dashboard/DashboardClient.tsx` 상단 import에 추가:

```typescript
import { useRealtimeSync } from "@/lib/useRealtimeSync";
```

`DashboardClient` 함수 본문 첫 줄(다른 훅 호출 근처)에 추가:

```typescript
  useRealtimeSync();
```

- [ ] **Step 3: 빌드 확인**

Run: `pnpm --filter @tablign/web build`
Expected: 빌드 성공.

- [ ] **Step 4: 수동 검증**

두 개의 브라우저 탭에서 대시보드를 연다. 한 탭에서 컬렉션/링크를 추가하면 다른 탭에 (수 초 내) 자동 반영되는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/lib/useRealtimeSync.ts apps/web/src/app/dashboard/DashboardClient.tsx
git commit -m "feat(web): Realtime 구독으로 멀티 디바이스 동기화 추가"
```

---

## Task 6: 검색바

**Files:**
- Create: `apps/web/src/app/dashboard/SearchBar.tsx`
- Modify: `apps/web/src/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: SearchBar 작성**

Create `apps/web/src/app/dashboard/SearchBar.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useSearch } from "@/lib/queries";

function openUrl(url: string) {
  window.open(url, "_blank", "noopener");
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const { data } = useSearch(query);
  const hasResults = query.trim().length > 0 && data;

  return (
    <div style={{ position: "relative" }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="컬렉션·링크 검색"
        style={{ width: 280, padding: 6, border: "1px solid #ddd", borderRadius: 6 }}
      />
      {hasResults && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            width: 320,
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,.12)",
            padding: 8,
            zIndex: 10,
            maxHeight: 360,
            overflowY: "auto",
          }}
        >
          {data!.collections.length === 0 && data!.links.length === 0 && (
            <div style={{ color: "#888", padding: 8 }}>결과 없음</div>
          )}
          {data!.collections.map((c) => (
            <div key={`c-${c.id}`} style={{ padding: 6 }}>
              📁 {c.title}
            </div>
          ))}
          {data!.links.map((l) => (
            <button
              key={`l-${l.id}`}
              type="button"
              onClick={() => openUrl(l.url)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: 6,
                border: "none",
                background: "none",
                cursor: "pointer",
              }}
            >
              🔗 {l.custom_title ?? l.title ?? l.url}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: DashboardClient 헤더에 배치**

`apps/web/src/app/dashboard/DashboardClient.tsx` import에 추가:

```typescript
import { SearchBar } from "./SearchBar";
```

헤더(`<header>` 안, `<span>{userEmail}</span>` 옆)에 `<SearchBar />`를 추가한다. 예: `userEmail` span과 우측 버튼들 사이.

- [ ] **Step 3: 빌드 확인**

Run: `pnpm --filter @tablign/web build`
Expected: 빌드 성공.

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/app/dashboard/SearchBar.tsx apps/web/src/app/dashboard/DashboardClient.tsx
git commit -m "feat(web): 컬렉션/링크 검색바 추가"
```

---

## Task 7: 태그 칩 + 태그 필터

컬렉션 컬럼에 태그 칩을 보여주고 태그를 추가/제거하며, 사이드바에서 태그로 보드를 필터링한다.

**Files:**
- Create: `apps/web/src/app/dashboard/TagBar.tsx`
- Modify: `apps/web/src/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: TagBar 작성 (컬렉션별 태그 칩 + 추가)**

Create `apps/web/src/app/dashboard/TagBar.tsx`:

```tsx
"use client";

import { useCollectionTags, useTags, useCreateTag, useAddTagToCollection, useRemoveTagFromCollection } from "@/lib/queries";

export function TagBar({ collectionId, userId }: { collectionId: string; userId: string }) {
  const { data: tags = [] } = useCollectionTags(collectionId);
  const { data: allTags = [] } = useTags();
  const createTag = useCreateTag();
  const addTag = useAddTagToCollection(collectionId);
  const removeTag = useRemoveTagFromCollection(collectionId);

  function handleAdd() {
    const name = prompt("태그 이름 (기존 태그면 그 태그가 연결됩니다)");
    if (!name) return;
    const existing = allTags.find((t) => t.name === name);
    if (existing) {
      addTag.mutate(existing.id);
    } else {
      createTag.mutate(
        { user_id: userId, name },
        { onSuccess: (tag) => addTag.mutate(tag.id) },
      );
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
      {tags.map((t) => (
        <span
          key={t.id}
          style={{
            fontSize: 11,
            background: "#e6ebff",
            color: "#2c46a6",
            borderRadius: 10,
            padding: "2px 8px",
            display: "inline-flex",
            gap: 4,
          }}
        >
          #{t.name}
          <button
            type="button"
            onClick={() => removeTag.mutate(t.id)}
            style={{ border: "none", background: "none", cursor: "pointer", color: "inherit" }}
          >
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={handleAdd}
        style={{ fontSize: 11, border: "none", background: "none", color: "#06c", cursor: "pointer" }}
      >
        + 태그
      </button>
    </div>
  );
}
```

- [ ] **Step 2: DashboardClient에 태그 필터 상태 + TagBar 배치**

`DashboardClient.tsx`를 다음과 같이 확장한다:

(a) import 추가:
```typescript
import { TagBar } from "./TagBar";
import { useTags, useCollectionIdsForTag } from "@/lib/queries";
```

(b) `CollectionColumnContainer`의 헤더(`<header>`) 아래, 링크 목록 `<div>` 위에 `<TagBar collectionId={collection.id} userId={userId} />`를 추가한다. (이를 위해 `CollectionColumnContainer` props에 `userId`가 이미 있으므로 그대로 사용.)

(c) `DashboardClient` 본문에 태그 필터 상태 추가:
```typescript
  const { data: tags = [] } = useTags();
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const { data: taggedCollectionIds } = useCollectionIdsForTag(activeTagId);
```

(d) 보드에 렌더할 컬렉션을 필터링:
```typescript
  const visibleCollections = activeTagId
    ? collections.filter((c) => (taggedCollectionIds ?? []).includes(c.id))
    : collections;
```
그리고 `collections.map(...)`를 `visibleCollections.map(...)`로 바꾼다.

(e) Sidebar 아래(또는 헤더)에 태그 필터 UI를 추가한다. 헤더의 좌측, `userEmail` 근처에 태그 칩 줄을 둔다:
```tsx
<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
  {tags.map((t) => (
    <button
      key={t.id}
      type="button"
      onClick={() => setActiveTagId(activeTagId === t.id ? null : t.id)}
      style={{
        fontSize: 11,
        borderRadius: 10,
        padding: "2px 8px",
        border: "1px solid #cdd",
        cursor: "pointer",
        background: activeTagId === t.id ? "#2c46a6" : "#fff",
        color: activeTagId === t.id ? "#fff" : "#333",
      }}
    >
      #{t.name}
    </button>
  ))}
</div>
```

- [ ] **Step 3: 빌드 확인**

Run: `pnpm --filter @tablign/web build`
Expected: 빌드 성공.

- [ ] **Step 4: 수동 검증**

컬렉션에 태그 추가 → 헤더의 태그 칩 클릭 시 그 태그가 달린 컬렉션만 보이고, 다시 클릭하면 전체로 돌아오는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/app/dashboard/TagBar.tsx apps/web/src/app/dashboard/DashboardClient.tsx
git commit -m "feat(web): 컬렉션 태그 칩과 태그 필터 추가"
```

---

## Self-Review 결과

- **Spec 커버리지:** 구현순서 6(태그 + 검색: Task 1·2·4·6·7), 7(Realtime 동기화 + 낙관적 업데이트 중 Realtime 부분: Task 3·5)을 구현. 낙관적 업데이트는 Plan 2에서 invalidate 기반으로 단순화했고, Realtime이 그 위에 멀티 디바이스 동기화를 더한다.
- **타입 일관성:** 태그 함수는 `Tag` 타입, 검색은 `Collection`/`Link` 타입 사용. `listTagsForCollection`의 조인 결과 매핑 타입(`{ tags: Tag }`)과 `listCollectionIdsForTag`(`{ collection_id: string }`)을 명시. 훅 쿼리키(`tags`, `collection_tags`, `tag_collections`, `search`)는 Realtime 무효화 키(`spaces`/`collections`/`links`/`collection_tags`)와 정합.
- **Placeholder 스캔:** 모든 코드/명령 실제 내용 포함. Realtime·태그 필터의 수동 검증은 사람이 두 탭/클릭으로 확인하도록 명시.
- **주의:** Realtime 통합 테스트는 타이밍 의존성이 커 자동화하지 않고 수동 검증으로 둔다. 데이터 계층(tags/search)은 통합 테스트로 검증한다.

---

## 다음 단계

Plan 3 완료 후 Plan 4(크롬 확장 — 탭 저장·새 탭 페이지·Open all)를 같은 형식으로 작성한다.
