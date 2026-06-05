# tablign Plan 2 — 컬렉션 & 보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스페이스/컬렉션/링크를 만들고 보드형 대시보드에서 보고, 드래그로 정리하고, URL을 붙여넣으면 메타데이터(제목/파비콘/썸네일)가 채워지는 경험을 완성한다.

**Architecture:** 데이터 접근 로직은 `packages/core/src/data/*`에 순수 함수로 두고 로컬 Supabase 통합 테스트로 검증한다. 공용 React 컴포넌트는 `packages/ui`에 두고 웹 앱과 (향후) 확장이 공유한다. 웹은 TanStack Query로 서버 상태를 관리하고 `@dnd-kit`으로 드래그앤드롭을 처리한다. URL 메타데이터는 웹의 Route Handler `/api/metadata`가 OpenGraph를 수집한다.

**Tech Stack:** TypeScript, Supabase JS, Vitest, React 18, Next.js 15, TanStack Query v5, @dnd-kit.

**Prerequisites:** Plan 1 완료(모노레포, `@tablign/core` 타입·클라이언트, 로컬 Supabase + 스키마 + RLS, 웹 인증). 로컬 Supabase가 실행 중이어야 한다(`pnpm dlx supabase status`로 확인, 아니면 `pnpm dlx supabase start`). 통합 테스트는 `packages/core/.env.test`의 키를 사용한다(Plan 1에서 생성됨).

---

## File Structure

```
packages/core/src/
├── position.ts                 # 드래그 순서 계산 유틸 (순수 함수)
├── data/
│   ├── spaces.ts               # 스페이스 CRUD + 정렬
│   ├── collections.ts          # 컬렉션 CRUD + 정렬
│   └── links.ts                # 링크 CRUD + 정렬/이동
├── index.ts                    # (수정) data/* 와 position 재export
└── __tests__/
    ├── position.test.ts        # 순수 단위 테스트
    └── data.test.ts            # CRUD 통합 테스트(로컬 Supabase)

packages/ui/                    # 신규 공용 컴포넌트 패키지
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts
    ├── LinkCard.tsx
    ├── AddLinkInput.tsx
    ├── CollectionColumn.tsx
    ├── Board.tsx
    ├── Sidebar.tsx
    └── __tests__/
        ├── LinkCard.test.tsx
        └── AddLinkInput.test.tsx

apps/web/src/
├── app/
│   ├── providers.tsx           # TanStack Query Provider (client)
│   ├── layout.tsx              # (수정) Providers로 감싸기
│   ├── dashboard/
│   │   ├── page.tsx            # (수정) 서버: user 확인 후 DashboardClient 렌더
│   │   └── DashboardClient.tsx # 클라이언트: 데이터 패칭·뮤테이션·보드 조립
│   └── api/metadata/route.ts   # OpenGraph 메타데이터 수집
└── lib/
    ├── queries.ts              # TanStack Query 훅 (spaces/collections/links)
    └── metadata.ts             # /api/metadata 호출 헬퍼
```

---

## Task 1: position 계산 유틸 (TDD, 순수 함수)

드래그로 항목을 특정 위치에 넣을 때 새 `position` 값을 계산한다. 큰 간격(기본 1000) 방식.

**Files:**
- Create: `packages/core/src/position.ts`
- Create: `packages/core/src/__tests__/position.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `packages/core/src/__tests__/position.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { positionBetween, GAP } from "../position";

describe("positionBetween", () => {
  it("앞뒤가 모두 없으면 기본 간격을 반환한다", () => {
    expect(positionBetween(undefined, undefined)).toBe(GAP);
  });

  it("맨 앞에 넣으면 다음 항목보다 GAP만큼 작다", () => {
    expect(positionBetween(undefined, 2000)).toBe(2000 - GAP);
  });

  it("맨 뒤에 넣으면 이전 항목보다 GAP만큼 크다", () => {
    expect(positionBetween(2000, undefined)).toBe(2000 + GAP);
  });

  it("두 항목 사이에 넣으면 중간값을 반환한다", () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `pnpm --filter @tablign/core test position`
Expected: FAIL — `../position` 모듈/함수 없음.

- [ ] **Step 3: 구현 작성**

Create `packages/core/src/position.ts`:

```typescript
/** 새 항목 삽입 시 사용하는 기본 간격 */
export const GAP = 1000;

/**
 * 두 인접 항목의 position 사이에 들어갈 새 position을 계산한다.
 * before/after는 드롭 위치의 앞/뒤 항목 position (없으면 undefined).
 */
export function positionBetween(
  before: number | undefined,
  after: number | undefined,
): number {
  if (before === undefined && after === undefined) return GAP;
  if (before === undefined) return after! - GAP;
  if (after === undefined) return before + GAP;
  return (before + after) / 2;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `pnpm --filter @tablign/core test position`
Expected: 4 tests PASS.

- [ ] **Step 5: index.ts에 재export 추가**

Modify `packages/core/src/index.ts` — 기존 export 아래에 추가:

```typescript
export * from "./position";
```

- [ ] **Step 6: 커밋**

```bash
git add packages/core/src/position.ts packages/core/src/__tests__/position.test.ts packages/core/src/index.ts
git commit -m "feat(core): position 계산 유틸 추가"
```

---

## Task 2: 스페이스 데이터 접근 (TDD, 통합 테스트)

**Files:**
- Create: `packages/core/src/data/spaces.ts`
- Create: `packages/core/src/__tests__/data.test.ts` (이 Task에서 만들고 Task 3·4에서 확장)
- Modify: `packages/core/src/index.ts`

데이터 접근 함수는 모두 `SupabaseClient`를 첫 인자로 받는다(웹의 SSR 클라이언트, 확장의 클라이언트 모두 주입 가능).

- [ ] **Step 1: 테스트 공용 헬퍼 + 실패 테스트 작성**

Create `packages/core/src/__tests__/data.test.ts`:

```typescript
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listSpaces, createSpace, updateSpace, deleteSpace } from "../data/spaces";

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
if (!URL || !ANON || !SERVICE) throw new Error(".env.test 키 누락");

async function makeUser(email: string): Promise<{ client: SupabaseClient; id: string }> {
  const admin = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: "password123",
    email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: "password123",
  });
  if (signInErr) throw signInErr;
  return { client, id: created.user!.id };
}

describe("spaces 데이터 접근", () => {
  let user: { client: SupabaseClient; id: string };

  beforeAll(async () => {
    user = await makeUser(`spaces-${Date.now()}@test.local`);
  });

  it("스페이스를 만들고 목록에 나타난다", async () => {
    const created = await createSpace(user.client, { user_id: user.id, name: "개인" });
    expect(created.name).toBe("개인");
    const list = await listSpaces(user.client);
    expect(list.some((s) => s.id === created.id)).toBe(true);
  });

  it("스페이스 이름을 수정한다", async () => {
    const created = await createSpace(user.client, { user_id: user.id, name: "임시" });
    const updated = await updateSpace(user.client, created.id, { name: "수정됨" });
    expect(updated.name).toBe("수정됨");
  });

  it("스페이스를 삭제한다", async () => {
    const created = await createSpace(user.client, { user_id: user.id, name: "삭제대상" });
    await deleteSpace(user.client, created.id);
    const list = await listSpaces(user.client);
    expect(list.some((s) => s.id === created.id)).toBe(false);
  });

  it("목록은 position 오름차순으로 정렬된다", async () => {
    const u = await makeUser(`spaces-order-${Date.now()}@test.local`);
    await createSpace(u.client, { user_id: u.id, name: "A", position: 3000 });
    await createSpace(u.client, { user_id: u.id, name: "B", position: 1000 });
    const list = await listSpaces(u.client);
    const positions = list.map((s) => s.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `pnpm --filter @tablign/core test data`
Expected: FAIL — `../data/spaces` 없음.

- [ ] **Step 3: 구현 작성**

Create `packages/core/src/data/spaces.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Space } from "../types";

export interface CreateSpaceInput {
  user_id: string;
  name: string;
  icon?: string | null;
  position?: number;
}

export async function listSpaces(client: SupabaseClient): Promise<Space[]> {
  const { data, error } = await client
    .from("spaces")
    .select()
    .order("position", { ascending: true });
  if (error) throw error;
  return data as Space[];
}

export async function createSpace(
  client: SupabaseClient,
  input: CreateSpaceInput,
): Promise<Space> {
  const { data, error } = await client
    .from("spaces")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Space;
}

export async function updateSpace(
  client: SupabaseClient,
  id: string,
  patch: Partial<Pick<Space, "name" | "icon" | "position">>,
): Promise<Space> {
  const { data, error } = await client
    .from("spaces")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Space;
}

export async function deleteSpace(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("spaces").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `pnpm --filter @tablign/core test data`
Expected: 4 tests PASS.

- [ ] **Step 5: index.ts에 재export 추가**

Modify `packages/core/src/index.ts` — 추가:

```typescript
export * from "./data/spaces";
```

- [ ] **Step 6: 커밋**

```bash
git add packages/core/src/data/spaces.ts packages/core/src/__tests__/data.test.ts packages/core/src/index.ts
git commit -m "feat(core): 스페이스 데이터 접근 함수 추가"
```

---

## Task 3: 컬렉션 데이터 접근 (TDD)

**Files:**
- Create: `packages/core/src/data/collections.ts`
- Modify: `packages/core/src/__tests__/data.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: data.test.ts에 컬렉션 describe 추가**

`packages/core/src/__tests__/data.test.ts` 상단 import에 추가:

```typescript
import { listCollections, createCollection, updateCollection, deleteCollection } from "../data/collections";
```

파일 끝에 describe 블록 추가:

```typescript
describe("collections 데이터 접근", () => {
  let user: { client: SupabaseClient; id: string };
  let spaceId: string;

  beforeAll(async () => {
    user = await makeUser(`cols-${Date.now()}@test.local`);
    const space = await createSpace(user.client, { user_id: user.id, name: "개인" });
    spaceId = space.id;
  });

  it("컬렉션을 만들고 스페이스별로 조회한다", async () => {
    const created = await createCollection(user.client, {
      user_id: user.id,
      space_id: spaceId,
      title: "읽을거리",
    });
    expect(created.title).toBe("읽을거리");
    const list = await listCollections(user.client, spaceId);
    expect(list.some((c) => c.id === created.id)).toBe(true);
  });

  it("컬렉션 제목과 노트를 수정한다", async () => {
    const created = await createCollection(user.client, {
      user_id: user.id,
      space_id: spaceId,
      title: "임시",
    });
    const updated = await updateCollection(user.client, created.id, {
      title: "수정됨",
      note: "메모",
    });
    expect(updated.title).toBe("수정됨");
    expect(updated.note).toBe("메모");
  });

  it("컬렉션을 삭제한다", async () => {
    const created = await createCollection(user.client, {
      user_id: user.id,
      space_id: spaceId,
      title: "삭제대상",
    });
    await deleteCollection(user.client, created.id);
    const list = await listCollections(user.client, spaceId);
    expect(list.some((c) => c.id === created.id)).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `pnpm --filter @tablign/core test data`
Expected: FAIL — `../data/collections` 없음.

- [ ] **Step 3: 구현 작성**

Create `packages/core/src/data/collections.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection } from "../types";

export interface CreateCollectionInput {
  user_id: string;
  space_id: string;
  title: string;
  icon?: string | null;
  note?: string | null;
  position?: number;
}

export async function listCollections(
  client: SupabaseClient,
  spaceId: string,
): Promise<Collection[]> {
  const { data, error } = await client
    .from("collections")
    .select()
    .eq("space_id", spaceId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data as Collection[];
}

export async function createCollection(
  client: SupabaseClient,
  input: CreateCollectionInput,
): Promise<Collection> {
  const { data, error } = await client
    .from("collections")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Collection;
}

export async function updateCollection(
  client: SupabaseClient,
  id: string,
  patch: Partial<Pick<Collection, "title" | "icon" | "note" | "position" | "space_id">>,
): Promise<Collection> {
  const { data, error } = await client
    .from("collections")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Collection;
}

export async function deleteCollection(
  client: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await client.from("collections").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `pnpm --filter @tablign/core test data`
Expected: 모든 테스트 PASS(스페이스 4 + 컬렉션 3).

- [ ] **Step 5: index.ts에 재export 추가**

```typescript
export * from "./data/collections";
```

- [ ] **Step 6: 커밋**

```bash
git add packages/core/src/data/collections.ts packages/core/src/__tests__/data.test.ts packages/core/src/index.ts
git commit -m "feat(core): 컬렉션 데이터 접근 함수 추가"
```

---

## Task 4: 링크 데이터 접근 (TDD)

**Files:**
- Create: `packages/core/src/data/links.ts`
- Modify: `packages/core/src/__tests__/data.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: data.test.ts에 링크 describe 추가**

상단 import에 추가:

```typescript
import { listLinks, createLink, updateLink, deleteLink, moveLink } from "../data/links";
import { listCollections as _lc } from "../data/collections";
```

파일 끝에 추가:

```typescript
describe("links 데이터 접근", () => {
  let user: { client: SupabaseClient; id: string };
  let collectionId: string;
  let otherCollectionId: string;

  beforeAll(async () => {
    user = await makeUser(`links-${Date.now()}@test.local`);
    const space = await createSpace(user.client, { user_id: user.id, name: "개인" });
    const c1 = await createCollection(user.client, {
      user_id: user.id,
      space_id: space.id,
      title: "C1",
    });
    const c2 = await createCollection(user.client, {
      user_id: user.id,
      space_id: space.id,
      title: "C2",
    });
    collectionId = c1.id;
    otherCollectionId = c2.id;
  });

  it("링크를 만들고 컬렉션별로 조회한다", async () => {
    const created = await createLink(user.client, {
      user_id: user.id,
      collection_id: collectionId,
      url: "https://example.com",
      title: "예시",
    });
    expect(created.url).toBe("https://example.com");
    const list = await listLinks(user.client, collectionId);
    expect(list.some((l) => l.id === created.id)).toBe(true);
  });

  it("링크 제목을 수정한다", async () => {
    const created = await createLink(user.client, {
      user_id: user.id,
      collection_id: collectionId,
      url: "https://a.com",
    });
    const updated = await updateLink(user.client, created.id, { custom_title: "내 제목" });
    expect(updated.custom_title).toBe("내 제목");
  });

  it("링크를 다른 컬렉션으로 이동하고 position을 갱신한다", async () => {
    const created = await createLink(user.client, {
      user_id: user.id,
      collection_id: collectionId,
      url: "https://move.com",
    });
    const moved = await moveLink(user.client, created.id, otherCollectionId, 500);
    expect(moved.collection_id).toBe(otherCollectionId);
    expect(moved.position).toBe(500);
    const fromList = await listLinks(user.client, collectionId);
    expect(fromList.some((l) => l.id === created.id)).toBe(false);
  });

  it("링크를 삭제한다", async () => {
    const created = await createLink(user.client, {
      user_id: user.id,
      collection_id: collectionId,
      url: "https://del.com",
    });
    await deleteLink(user.client, created.id);
    const list = await listLinks(user.client, collectionId);
    expect(list.some((l) => l.id === created.id)).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `pnpm --filter @tablign/core test data`
Expected: FAIL — `../data/links` 없음.

- [ ] **Step 3: 구현 작성**

Create `packages/core/src/data/links.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Link } from "../types";

export interface CreateLinkInput {
  user_id: string;
  collection_id: string;
  url: string;
  title?: string | null;
  favicon_url?: string | null;
  thumbnail_url?: string | null;
  custom_title?: string | null;
  position?: number;
}

export async function listLinks(
  client: SupabaseClient,
  collectionId: string,
): Promise<Link[]> {
  const { data, error } = await client
    .from("links")
    .select()
    .eq("collection_id", collectionId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data as Link[];
}

export async function createLink(
  client: SupabaseClient,
  input: CreateLinkInput,
): Promise<Link> {
  const { data, error } = await client
    .from("links")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Link;
}

export async function updateLink(
  client: SupabaseClient,
  id: string,
  patch: Partial<
    Pick<Link, "title" | "custom_title" | "favicon_url" | "thumbnail_url" | "position">
  >,
): Promise<Link> {
  const { data, error } = await client
    .from("links")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Link;
}

export async function moveLink(
  client: SupabaseClient,
  id: string,
  collectionId: string,
  position: number,
): Promise<Link> {
  const { data, error } = await client
    .from("links")
    .update({ collection_id: collectionId, position })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Link;
}

export async function deleteLink(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("links").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `pnpm --filter @tablign/core test`
Expected: 전체 PASS (position 4 + rls 3 + spaces 4 + collections 3 + links 4).

- [ ] **Step 5: index.ts에 재export + lint**

```typescript
export * from "./data/links";
```

Run: `pnpm --filter @tablign/core lint`
Expected: tsc PASS.

- [ ] **Step 6: 커밋**

```bash
git add packages/core/src/data/links.ts packages/core/src/__tests__/data.test.ts packages/core/src/index.ts
git commit -m "feat(core): 링크 데이터 접근 함수 추가"
```

---

## Task 5: packages/ui 패키지 + LinkCard (TDD 컴포넌트)

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/vitest.config.ts`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/LinkCard.tsx`
- Create: `packages/ui/src/__tests__/LinkCard.test.tsx`

- [ ] **Step 1: 패키지 설정 파일 작성**

Create `packages/ui/package.json`:

```json
{
  "name": "@tablign/ui",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@tablign/core": "workspace:*"
  },
  "peerDependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "jsdom": "^25.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

Create `packages/ui/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

Create `packages/ui/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
  },
});
```

Create `packages/ui/src/__tests__/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 2: 실패하는 테스트 작성**

Create `packages/ui/src/__tests__/LinkCard.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LinkCard } from "../LinkCard";
import type { Link } from "@tablign/core";

const baseLink: Link = {
  id: "1",
  collection_id: "c1",
  user_id: "u1",
  url: "https://example.com/page",
  title: "예시 제목",
  favicon_url: null,
  thumbnail_url: null,
  custom_title: null,
  position: 1000,
  created_at: "2026-01-01T00:00:00Z",
};

describe("LinkCard", () => {
  it("custom_title이 있으면 그것을, 없으면 title을 보여준다", () => {
    const { rerender } = render(<LinkCard link={baseLink} onOpen={() => {}} />);
    expect(screen.getByText("예시 제목")).toBeInTheDocument();
    rerender(<LinkCard link={{ ...baseLink, custom_title: "내가 정한 제목" }} onOpen={() => {}} />);
    expect(screen.getByText("내가 정한 제목")).toBeInTheDocument();
  });

  it("title도 custom_title도 없으면 도메인을 보여준다", () => {
    render(<LinkCard link={{ ...baseLink, title: null }} onOpen={() => {}} />);
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });

  it("클릭하면 onOpen이 url과 함께 호출된다", () => {
    const onOpen = vi.fn();
    render(<LinkCard link={baseLink} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledWith("https://example.com/page");
  });
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `pnpm install` (새 패키지 의존성 설치)
Run: `pnpm --filter @tablign/ui test`
Expected: FAIL — `../LinkCard` 없음.

- [ ] **Step 4: 구현 작성**

Create `packages/ui/src/LinkCard.tsx`:

```tsx
import type { Link } from "@tablign/core";

export interface LinkCardProps {
  link: Link;
  onOpen: (url: string) => void;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function LinkCard({ link, onOpen }: LinkCardProps) {
  const label = link.custom_title ?? link.title ?? domainOf(link.url);
  return (
    <button
      type="button"
      onClick={() => onOpen(link.url)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: 8,
        textAlign: "left",
        border: "1px solid #eee",
        borderRadius: 6,
        background: "#fff",
        cursor: "pointer",
      }}
    >
      {link.favicon_url ? (
        <img src={link.favicon_url} alt="" width={16} height={16} />
      ) : (
        <span aria-hidden style={{ width: 16, height: 16 }}>🔗</span>
      )}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
    </button>
  );
}
```

Create `packages/ui/src/index.ts`:

```typescript
export * from "./LinkCard";
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `pnpm --filter @tablign/ui test`
Expected: 3 tests PASS.

- [ ] **Step 6: 커밋**

```bash
git add packages/ui pnpm-lock.yaml
git commit -m "feat(ui): UI 패키지와 LinkCard 컴포넌트 추가"
```

---

## Task 6: AddLinkInput + CollectionColumn + Board + Sidebar

LinkCard 외 나머지 표시 컴포넌트. AddLinkInput만 동작(입력→콜백) 테스트하고, 레이아웃 컴포넌트는 렌더만 확인한다.

**Files:**
- Create: `packages/ui/src/AddLinkInput.tsx`
- Create: `packages/ui/src/CollectionColumn.tsx`
- Create: `packages/ui/src/Board.tsx`
- Create: `packages/ui/src/Sidebar.tsx`
- Create: `packages/ui/src/__tests__/AddLinkInput.test.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: AddLinkInput 실패 테스트 작성**

Create `packages/ui/src/__tests__/AddLinkInput.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddLinkInput } from "../AddLinkInput";

describe("AddLinkInput", () => {
  it("URL을 입력하고 제출하면 onAdd가 호출되고 입력이 비워진다", () => {
    const onAdd = vi.fn();
    render(<AddLinkInput onAdd={onAdd} />);
    const input = screen.getByPlaceholderText("URL 붙여넣기") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://x.com" } });
    fireEvent.submit(input.closest("form")!);
    expect(onAdd).toHaveBeenCalledWith("https://x.com");
    expect(input.value).toBe("");
  });

  it("빈 입력은 onAdd를 호출하지 않는다", () => {
    const onAdd = vi.fn();
    render(<AddLinkInput onAdd={onAdd} />);
    const input = screen.getByPlaceholderText("URL 붙여넣기");
    fireEvent.submit(input.closest("form")!);
    expect(onAdd).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `pnpm --filter @tablign/ui test AddLinkInput`
Expected: FAIL — `../AddLinkInput` 없음.

- [ ] **Step 3: AddLinkInput 구현**

Create `packages/ui/src/AddLinkInput.tsx`:

```tsx
import { useState } from "react";

export interface AddLinkInputProps {
  onAdd: (url: string) => void;
}

export function AddLinkInput({ onAdd }: AddLinkInputProps) {
  const [value, setValue] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
  }

  return (
    <form onSubmit={submit}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="URL 붙여넣기"
        style={{ width: "100%", padding: 6, border: "1px solid #ddd", borderRadius: 6 }}
      />
    </form>
  );
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `pnpm --filter @tablign/ui test AddLinkInput`
Expected: 2 tests PASS.

- [ ] **Step 5: 레이아웃 컴포넌트 작성**

Create `packages/ui/src/CollectionColumn.tsx`:

```tsx
import type { Collection, Link } from "@tablign/core";
import { LinkCard } from "./LinkCard";
import { AddLinkInput } from "./AddLinkInput";

export interface CollectionColumnProps {
  collection: Collection;
  links: Link[];
  onOpenLink: (url: string) => void;
  onAddLink: (url: string) => void;
  onOpenAll: (collectionId: string) => void;
  onDeleteCollection: (collectionId: string) => void;
}

export function CollectionColumn({
  collection,
  links,
  onOpenLink,
  onAddLink,
  onOpenAll,
  onDeleteCollection,
}: CollectionColumnProps) {
  return (
    <section
      style={{
        width: 260,
        flexShrink: 0,
        background: "#f7f8fa",
        borderRadius: 10,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>
          {collection.icon ? `${collection.icon} ` : ""}
          {collection.title}
        </strong>
        <span style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => onOpenAll(collection.id)} title="모두 열기">
            ↗
          </button>
          <button type="button" onClick={() => onDeleteCollection(collection.id)} title="삭제">
            ✕
          </button>
        </span>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {links.map((link) => (
          <LinkCard key={link.id} link={link} onOpen={onOpenLink} />
        ))}
      </div>
      <AddLinkInput onAdd={onAddLink} />
    </section>
  );
}
```

Create `packages/ui/src/Board.tsx`:

```tsx
import type { ReactNode } from "react";

export interface BoardProps {
  children: ReactNode;
}

export function Board({ children }: BoardProps) {
  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: 16, alignItems: "flex-start" }}>
      {children}
    </div>
  );
}
```

Create `packages/ui/src/Sidebar.tsx`:

```tsx
import type { Space } from "@tablign/core";

export interface SidebarProps {
  spaces: Space[];
  activeSpaceId: string | null;
  onSelectSpace: (spaceId: string) => void;
  onAddSpace: () => void;
}

export function Sidebar({ spaces, activeSpaceId, onSelectSpace, onAddSpace }: SidebarProps) {
  return (
    <nav
      style={{
        width: 200,
        flexShrink: 0,
        background: "#1e2330",
        color: "#cfd3dc",
        padding: 16,
        height: "100vh",
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontWeight: 700, color: "#fff", marginBottom: 16 }}>🗂 tablign</div>
      <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.6, marginBottom: 8 }}>SPACES</div>
      {spaces.map((space) => (
        <button
          key={space.id}
          type="button"
          onClick={() => onSelectSpace(space.id)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "6px 8px",
            marginBottom: 4,
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            background: space.id === activeSpaceId ? "#2c3346" : "transparent",
            color: "inherit",
          }}
        >
          {space.icon ? `${space.icon} ` : ""}
          {space.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onAddSpace}
        style={{ marginTop: 8, background: "none", border: "none", color: "#8ab4ff", cursor: "pointer" }}
      >
        + 스페이스 추가
      </button>
    </nav>
  );
}
```

- [ ] **Step 6: index.ts 갱신**

Replace `packages/ui/src/index.ts`:

```typescript
export * from "./LinkCard";
export * from "./AddLinkInput";
export * from "./CollectionColumn";
export * from "./Board";
export * from "./Sidebar";
```

- [ ] **Step 7: lint + 테스트**

Run: `pnpm --filter @tablign/ui lint`
Expected: tsc PASS.
Run: `pnpm --filter @tablign/ui test`
Expected: 전체 PASS (LinkCard 3 + AddLinkInput 2).

- [ ] **Step 8: 커밋**

```bash
git add packages/ui/src
git commit -m "feat(ui): AddLinkInput·CollectionColumn·Board·Sidebar 추가"
```

---

## Task 7: 메타데이터 Route Handler (TDD)

URL의 OpenGraph 제목/이미지/파비콘을 수집한다. 순수 파서 함수를 TDD로 만들고, Route Handler가 그것을 사용한다.

**Files:**
- Create: `apps/web/src/lib/parse-metadata.ts`
- Create: `apps/web/src/lib/parse-metadata.test.ts`
- Create: `apps/web/src/app/api/metadata/route.ts`
- Modify: `apps/web/package.json` (vitest devDep + test 스크립트)
- Create: `apps/web/vitest.config.ts`

- [ ] **Step 1: web에 vitest 설정 추가**

Modify `apps/web/package.json` — `scripts.test`를 교체하고 devDependencies에 추가:

```json
"test": "vitest run",
```
devDependencies에 추가:
```json
"vitest": "^2.0.0"
```

Create `apps/web/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { globals: true, environment: "node" },
});
```

- [ ] **Step 2: 실패하는 파서 테스트 작성**

Create `apps/web/src/lib/parse-metadata.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parseMetadata } from "./parse-metadata";

const html = `
<html><head>
  <title>일반 제목</title>
  <meta property="og:title" content="OG 제목" />
  <meta property="og:image" content="https://cdn.example.com/img.png" />
  <link rel="icon" href="/favicon.ico" />
</head><body></body></html>`;

describe("parseMetadata", () => {
  it("og:title을 우선 제목으로 추출한다", () => {
    const m = parseMetadata(html, "https://example.com/page");
    expect(m.title).toBe("OG 제목");
  });

  it("og:image를 썸네일로 추출한다", () => {
    const m = parseMetadata(html, "https://example.com/page");
    expect(m.thumbnail_url).toBe("https://cdn.example.com/img.png");
  });

  it("상대 경로 favicon을 절대 URL로 변환한다", () => {
    const m = parseMetadata(html, "https://example.com/page");
    expect(m.favicon_url).toBe("https://example.com/favicon.ico");
  });

  it("og:title이 없으면 <title>을 쓴다", () => {
    const m = parseMetadata("<title>오직 타이틀</title>", "https://x.com");
    expect(m.title).toBe("오직 타이틀");
  });

  it("아무 메타도 없으면 title은 null, favicon은 기본 /favicon.ico 절대경로", () => {
    const m = parseMetadata("<html></html>", "https://x.com/a/b");
    expect(m.title).toBeNull();
    expect(m.favicon_url).toBe("https://x.com/favicon.ico");
  });
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인**

Run: `pnpm install`
Run: `pnpm --filter @tablign/web test`
Expected: FAIL — `./parse-metadata` 없음.

- [ ] **Step 4: 파서 구현**

Create `apps/web/src/lib/parse-metadata.ts`:

```typescript
export interface ParsedMetadata {
  title: string | null;
  thumbnail_url: string | null;
  favicon_url: string | null;
}

function matchAttr(html: string, regex: RegExp): string | null {
  const m = html.match(regex);
  return m ? m[1].trim() : null;
}

function toAbsolute(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

export function parseMetadata(html: string, pageUrl: string): ParsedMetadata {
  const ogTitle = matchAttr(
    html,
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  );
  const docTitle = matchAttr(html, /<title[^>]*>([^<]*)<\/title>/i);
  const ogImage = matchAttr(
    html,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  );
  const iconHref = matchAttr(
    html,
    /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
  );

  return {
    title: ogTitle ?? docTitle ?? null,
    thumbnail_url: ogImage ? toAbsolute(ogImage, pageUrl) : null,
    favicon_url: toAbsolute(iconHref ?? "/favicon.ico", pageUrl),
  };
}
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `pnpm --filter @tablign/web test`
Expected: 5 tests PASS.

- [ ] **Step 6: Route Handler 작성**

Create `apps/web/src/app/api/metadata/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { parseMetadata } from "@/lib/parse-metadata";

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url 파라미터 필요" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "tablign-bot" },
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();
    return NextResponse.json(parseMetadata(html, url));
  } catch {
    // 수집 실패 시 폴백: 제목 없음, 도메인 기반 favicon
    return NextResponse.json(parseMetadata("", url));
  }
}
```

- [ ] **Step 7: 빌드 확인**

Run: `pnpm --filter @tablign/web build`
Expected: 빌드 성공, `/api/metadata`가 라우트 목록에 나타남.

- [ ] **Step 8: 커밋**

```bash
git add apps/web/src/lib/parse-metadata.ts apps/web/src/lib/parse-metadata.test.ts apps/web/src/app/api/metadata apps/web/vitest.config.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): URL 메타데이터 수집 라우트와 파서 추가"
```

---

## Task 8: TanStack Query 설정 + 쿼리 훅

**Files:**
- Create: `apps/web/src/app/providers.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/lib/queries.ts`
- Create: `apps/web/src/lib/metadata.ts`
- Modify: `apps/web/package.json` (@tanstack/react-query)

- [ ] **Step 1: 의존성 추가**

Modify `apps/web/package.json` dependencies에 추가:

```json
"@tanstack/react-query": "^5.50.0"
```
Run: `pnpm install`

- [ ] **Step 2: Providers 작성**

Create `apps/web/src/app/providers.tsx`:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 3: layout.tsx에서 Providers로 감싸기**

Modify `apps/web/src/app/layout.tsx` — body 내부를 Providers로 감싼다:

```tsx
import { Providers } from "./providers";

export const metadata = {
  title: "tablign",
  description: "시각적 북마크·탭 관리",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: 메타데이터 호출 헬퍼 작성**

Create `apps/web/src/lib/metadata.ts`:

```typescript
import type { ParsedMetadata } from "./parse-metadata";

export async function fetchMetadata(url: string): Promise<ParsedMetadata> {
  const res = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    return { title: null, thumbnail_url: null, favicon_url: null };
  }
  return (await res.json()) as ParsedMetadata;
}
```

- [ ] **Step 5: 쿼리/뮤테이션 훅 작성**

Create `apps/web/src/lib/queries.ts`:

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listSpaces,
  createSpace,
  listCollections,
  createCollection,
  deleteCollection,
  listLinks,
  createLink,
  deleteLink,
  moveLink,
  updateLink,
} from "@tablign/core";
import { createClient } from "./supabase/browser";
import { fetchMetadata } from "./metadata";

const supabase = createClient();

export function useSpaces() {
  return useQuery({ queryKey: ["spaces"], queryFn: () => listSpaces(supabase) });
}

export function useCreateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { user_id: string; name: string }) => createSpace(supabase, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spaces"] }),
  });
}

export function useCollections(spaceId: string | null) {
  return useQuery({
    queryKey: ["collections", spaceId],
    queryFn: () => listCollections(supabase, spaceId!),
    enabled: !!spaceId,
  });
}

export function useCreateCollection(spaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { user_id: string; space_id: string; title: string }) =>
      createCollection(supabase, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections", spaceId] }),
  });
}

export function useDeleteCollection(spaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCollection(supabase, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections", spaceId] }),
  });
}

export function useLinks(collectionId: string) {
  return useQuery({
    queryKey: ["links", collectionId],
    queryFn: () => listLinks(supabase, collectionId),
  });
}

export function useAddLink(collectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { user_id: string; url: string }) => {
      const meta = await fetchMetadata(input.url);
      return createLink(supabase, {
        user_id: input.user_id,
        collection_id: collectionId,
        url: input.url,
        title: meta.title,
        favicon_url: meta.favicon_url,
        thumbnail_url: meta.thumbnail_url,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["links", collectionId] }),
  });
}

export function useDeleteLink(collectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLink(supabase, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["links", collectionId] }),
  });
}

export { moveLink, updateLink, supabase };
```

- [ ] **Step 6: 빌드 확인**

Run: `pnpm --filter @tablign/web build`
Expected: 빌드 성공.

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src/app/providers.tsx apps/web/src/app/layout.tsx apps/web/src/lib/queries.ts apps/web/src/lib/metadata.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): TanStack Query 설정과 데이터 훅 추가"
```

---

## Task 9: 대시보드에 보드 조립 (데이터 + 뮤테이션)

서버 컴포넌트는 user만 확인하고, 클라이언트 컴포넌트가 보드를 그린다. 드래그앤드롭은 Task 10에서 추가.

**Files:**
- Modify: `apps/web/src/app/dashboard/page.tsx`
- Create: `apps/web/src/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: 서버 페이지에서 user id 전달**

Modify `apps/web/src/app/dashboard/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <DashboardClient userId={user.id} userEmail={user.email ?? ""} />;
}
```

- [ ] **Step 2: 클라이언트 컴포넌트 작성**

Create `apps/web/src/app/dashboard/DashboardClient.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Board, Sidebar, CollectionColumn } from "@tablign/ui";
import type { Collection } from "@tablign/core";
import {
  useSpaces,
  useCreateSpace,
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  useLinks,
  useAddLink,
} from "@/lib/queries";

function openUrl(url: string) {
  window.open(url, "_blank", "noopener");
}

function CollectionColumnContainer({
  collection,
  userId,
  onDelete,
}: {
  collection: Collection;
  userId: string;
  onDelete: (id: string) => void;
}) {
  const { data: links = [] } = useLinks(collection.id);
  const addLink = useAddLink(collection.id);
  return (
    <CollectionColumn
      collection={collection}
      links={links}
      onOpenLink={openUrl}
      onAddLink={(url) => addLink.mutate({ user_id: userId, url })}
      onOpenAll={() => links.forEach((l) => openUrl(l.url))}
      onDeleteCollection={onDelete}
    />
  );
}

export function DashboardClient({ userId, userEmail }: { userId: string; userEmail: string }) {
  const { data: spaces = [] } = useSpaces();
  const createSpace = useCreateSpace();
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSpaceId && spaces.length > 0) setActiveSpaceId(spaces[0].id);
  }, [spaces, activeSpaceId]);

  const { data: collections = [] } = useCollections(activeSpaceId);
  const createCollection = useCreateCollection(activeSpaceId);
  const deleteCollection = useDeleteCollection(activeSpaceId);

  return (
    <div style={{ display: "flex" }}>
      <Sidebar
        spaces={spaces}
        activeSpaceId={activeSpaceId}
        onSelectSpace={setActiveSpaceId}
        onAddSpace={() => {
          const name = prompt("새 스페이스 이름");
          if (name) createSpace.mutate({ user_id: userId, name });
        }}
      />
      <main style={{ flex: 1 }}>
        <header style={{ display: "flex", justifyContent: "space-between", padding: 16 }}>
          <span>{userEmail}</span>
          <span style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                if (!activeSpaceId) return;
                const title = prompt("새 컬렉션 제목");
                if (title) createCollection.mutate({ user_id: userId, space_id: activeSpaceId, title });
              }}
            >
              + 컬렉션
            </button>
            <form action="/auth/signout" method="post">
              <button type="submit">로그아웃</button>
            </form>
          </span>
        </header>
        <Board>
          {collections.map((c) => (
            <CollectionColumnContainer
              key={c.id}
              collection={c}
              userId={userId}
              onDelete={(id) => deleteCollection.mutate(id)}
            />
          ))}
        </Board>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: web의 transpilePackages에 @tablign/ui 추가**

Modify `apps/web/next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tablign/core", "@tablign/ui"],
};

export default nextConfig;
```

- [ ] **Step 4: web에 @tablign/ui 의존성 추가 + 빌드**

Modify `apps/web/package.json` dependencies에 추가:

```json
"@tablign/ui": "workspace:*"
```
Run: `pnpm install`
Run: `pnpm --filter @tablign/web build`
Expected: 빌드 성공.

- [ ] **Step 5: 수동 검증 (dev 서버)**

로컬 Supabase 실행 확인 후 `pnpm --filter @tablign/web dev`. 로그인 → 스페이스 추가 → 컬렉션 추가 → URL 붙여넣기로 링크 추가 → 링크 카드 클릭 시 새 탭 열림 → "모두 열기" 동작 확인.

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/app/dashboard apps/web/next.config.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): 대시보드 보드 조립(스페이스/컬렉션/링크 CRUD)"
```

---

## Task 10: 드래그 앤 드롭 (@dnd-kit) + position 영속화

링크를 같은/다른 컬렉션으로 드래그해 순서·소속을 바꾸고, `positionBetween`으로 새 position을 계산해 저장한다.

**Files:**
- Modify: `apps/web/package.json` (@dnd-kit/core, @dnd-kit/sortable)
- Create: `apps/web/src/app/dashboard/BoardDnd.tsx`
- Modify: `apps/web/src/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: 의존성 추가**

Modify `apps/web/package.json` dependencies:

```json
"@dnd-kit/core": "^6.1.0",
"@dnd-kit/sortable": "^8.0.0"
```
Run: `pnpm install`

- [ ] **Step 2: DnD 래퍼 작성**

Create `apps/web/src/app/dashboard/BoardDnd.tsx`:

```tsx
"use client";

import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { ReactNode } from "react";

export interface BoardDndProps {
  children: ReactNode;
  onDragEnd: (event: DragEndEvent) => void;
}

export function BoardDnd({ children, onDragEnd }: BoardDndProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      {children}
    </DndContext>
  );
}
```

- [ ] **Step 3: 드래그 가능한 링크 래퍼 + 드롭 영역**

링크 카드를 draggable로, 컬렉션 컬럼을 droppable로 만든다. `DashboardClient.tsx`에서 `@dnd-kit/core`의 `useDraggable`/`useDroppable`을 사용하는 작은 래퍼를 같은 파일에 추가한다. `DashboardClient.tsx` 상단에 import 추가:

```tsx
import { useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { BoardDnd } from "./BoardDnd";
import { moveLink, updateLink, supabase } from "@/lib/queries";
import { positionBetween } from "@tablign/core";
import { useQueryClient } from "@tanstack/react-query";
import { LinkCard } from "@tablign/ui";
import type { Link } from "@tablign/core";
```

`CollectionColumnContainer`를 다음으로 교체(드롭 영역 + 드래그 항목 직접 렌더; 기존 `CollectionColumn` 대신 인라인 구성):

```tsx
function DraggableLink({ link }: { link: Link }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: link.id,
    data: { link },
  });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 1 }
    : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <LinkCard link={link} onOpen={openUrl} />
    </div>
  );
}

function CollectionColumnContainer({
  collection,
  userId,
  onDelete,
}: {
  collection: Collection;
  userId: string;
  onDelete: (id: string) => void;
}) {
  const { data: links = [] } = useLinks(collection.id);
  const addLink = useAddLink(collection.id);
  const { setNodeRef, isOver } = useDroppable({ id: collection.id, data: { collectionId: collection.id } });

  return (
    <section
      ref={setNodeRef}
      style={{
        width: 260,
        flexShrink: 0,
        background: isOver ? "#eef3ff" : "#f7f8fa",
        borderRadius: 10,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{collection.icon ? `${collection.icon} ` : ""}{collection.title}</strong>
        <span style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => links.forEach((l) => openUrl(l.url))} title="모두 열기">↗</button>
          <button type="button" onClick={() => onDelete(collection.id)} title="삭제">✕</button>
        </span>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {links.map((link) => (
          <DraggableLink key={link.id} link={link} />
        ))}
      </div>
      <AddLinkInputInline onAdd={(url) => addLink.mutate({ user_id: userId, url })} />
    </section>
  );
}
```

`AddLinkInput`은 `@tablign/ui`에서 import해 쓰되 이름 충돌을 피하려 다음 import 별칭을 상단에 둔다:

```tsx
import { AddLinkInput as AddLinkInputInline } from "@tablign/ui";
```

- [ ] **Step 4: onDragEnd 핸들러 + BoardDnd로 감싸기**

`DashboardClient` 컴포넌트 내부, `return` 직전에 추가:

```tsx
const qc = useQueryClient();

async function handleDragEnd(event: DragEndEvent) {
  const link = event.active.data.current?.link as Link | undefined;
  const targetCollectionId = event.over?.data.current?.collectionId as string | undefined;
  if (!link || !targetCollectionId) return;

  // 대상 컬렉션의 현재 링크를 가져와 맨 뒤 position 계산
  const targetLinks = qc.getQueryData<Link[]>(["links", targetCollectionId]) ?? [];
  const last = targetLinks.filter((l) => l.id !== link.id).at(-1);
  const newPos = positionBetween(last?.position, undefined);

  await moveLink(supabase, link.id, targetCollectionId, newPos);
  qc.invalidateQueries({ queryKey: ["links", link.collection_id] });
  qc.invalidateQueries({ queryKey: ["links", targetCollectionId] });
}
```

`<Board>...</Board>`를 `<BoardDnd onDragEnd={handleDragEnd}><Board>...</Board></BoardDnd>`로 감싼다.

- [ ] **Step 5: 빌드 확인**

Run: `pnpm --filter @tablign/web build`
Expected: 빌드 성공.

- [ ] **Step 6: 수동 검증**

dev 서버에서 링크를 다른 컬렉션으로 드래그 → 놓으면 그 컬렉션 맨 뒤로 이동하고 새로고침 후에도 유지됨을 확인.

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src/app/dashboard apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): @dnd-kit 드래그앤드롭과 position 영속화 추가"
```

---

## Self-Review 결과

- **Spec 커버리지:** 구현순서 3(스페이스/컬렉션/링크 CRUD + 보드 UI: Task 2~6,9), 4(메타데이터 라우트: Task 7,8), 5(드래그앤드롭 + position 재정렬: Task 1,10)을 모두 구현. Open all은 Task 6·9의 `onOpenAll`/forEach로 포함. 검색·태그·Realtime은 Plan 3, 확장은 Plan 4로 분리.
- **타입 일관성:** 데이터 함수는 `@tablign/core` 타입(Space/Collection/Link)을 사용하며 컬럼명 일치. `positionBetween(before, after)` 시그니처는 Task 1 정의와 Task 10 사용처가 일치. `moveLink(client, id, collectionId, position)` 시그니처 Task 4 정의 = Task 10 사용 일치.
- **Placeholder 스캔:** 모든 코드/명령에 실제 내용 포함. 수동 검증 단계(Task 9·10)는 dev 서버로 사람이 확인하는 것이라 명시.
- **주의:** Task 10에서 `CollectionColumn`(ui) 대신 인라인 droppable 구성으로 대체한다(드롭 영역 ref가 필요하므로). `@tablign/ui`의 `CollectionColumn`은 Plan 4(새 탭 페이지)에서 비-DnD 표시용으로 재사용 가능하게 남겨둔다.

---

## 다음 단계

Plan 2 완료 후 Plan 3(태그·검색·Realtime 동기화)을 같은 형식으로 작성한다.
