# 내 스페이스 간 컬렉션 복사/이동 구현 계획 (공유 1단계)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 컬렉션 헤더 `⋯` 메뉴에서 컬렉션을 내 다른 스페이스로 이동하거나 복사(링크 포함 딥카피)할 수 있게 한다.

**Architecture:** 복사는 Postgres RPC `copy_collection`(security definer)으로 서버에서 원자적으로 딥카피하고, 이동은 기존 `updateCollection`의 `space_id` 변경으로 처리한다. UI는 `packages/ui`에 자립형 `CollectionMoreMenu` 팝오버를 추가하고 `CollectionSection`에 슬롯으로 주입한다(기존 `linksSlot`/`tagSlot` 패턴). 완료 피드백은 기존 `ToastProvider`/`useToast`를 확장 엔트리에 마운트해 사용한다.

**Tech Stack:** Supabase(PostgreSQL RPC, RLS), TypeScript, React, vitest + @testing-library/react, pnpm workspace

**설계 문서:** `docs/superpowers/specs/2026-07-03-sharing-design.md` (5-1절)

## Global Constraints

- Node >= 20, pnpm 10.15.0 (packageManager 고정)
- 새 외부 의존성 추가 금지 — 아이콘은 기존 `lucide-react`에서 re-export
- UI 문구·코드 주석은 한국어 (기존 코드베이스 관례)
- position 정렬은 기존 double precision + `GAP`(1000) 방식 재사용
- 태그(`collection_tags`)는 복사하지 않는다 (설계 결정)
- 통합 테스트는 로컬 Supabase(`npx supabase start`) + `packages/core/.env.test` 필요
- 커밋 메시지는 기존 관례(`feat(core): ...`, `feat(ui): ...`, `feat(extension): ...`) 유지, 본문은 제목으로 부족할 때만 간결히

---

### Task 1: `copy_collection` RPC 마이그레이션

**Files:**
- Create: `supabase/migrations/0006_copy_collection.sql`
- Test: `packages/core/src/__tests__/copy-collection.test.ts` (새 파일)

**Interfaces:**
- Produces: SQL 함수 `public.copy_collection(p_collection_id uuid, p_target_space_id uuid) returns uuid` — 성공 시 새 컬렉션 id 반환. 원본 컬렉션·대상 스페이스가 호출자 소유가 아니면 예외.

- [ ] **Step 1: 실패하는 통합 테스트 작성**

`packages/core/src/__tests__/copy-collection.test.ts` 생성. `rls.test.ts`의 `makeUser` 패턴을 그대로 사용한다.

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

describe("copy_collection RPC", () => {
  let alice: { client: SupabaseClient; id: string };
  let bob: { client: SupabaseClient; id: string };
  let srcSpaceId: string;   // alice의 원본 스페이스
  let dstSpaceId: string;   // alice의 대상 스페이스
  let srcColId: string;     // 링크 2개를 가진 원본 컬렉션
  let bobSpaceId: string;   // bob의 스페이스

  beforeAll(async () => {
    alice = await makeUser(`copy-alice-${Date.now()}@test.local`);
    bob = await makeUser(`copy-bob-${Date.now()}@test.local`);

    const { data: s1 } = await alice.client.from("spaces")
      .insert({ user_id: alice.id, name: "원본" }).select().single();
    const { data: s2 } = await alice.client.from("spaces")
      .insert({ user_id: alice.id, name: "대상" }).select().single();
    srcSpaceId = s1!.id; dstSpaceId = s2!.id;

    const { data: c } = await alice.client.from("collections")
      .insert({ user_id: alice.id, space_id: srcSpaceId, title: "읽을거리", icon: "📚", note: "메모" })
      .select().single();
    srcColId = c!.id;

    await alice.client.from("links").insert([
      { user_id: alice.id, collection_id: srcColId, url: "https://a.com", title: "A", position: 1000 },
      { user_id: alice.id, collection_id: srcColId, url: "https://b.com", title: "B", note: "b메모", position: 2000 },
    ]);

    const { data: bs } = await bob.client.from("spaces")
      .insert({ user_id: bob.id, name: "Bob 스페이스" }).select().single();
    bobSpaceId = bs!.id;
  });

  it("컬렉션과 링크를 대상 스페이스로 딥카피하고 새 id를 반환한다", async () => {
    const { data: newId, error } = await alice.client.rpc("copy_collection", {
      p_collection_id: srcColId, p_target_space_id: dstSpaceId,
    });
    expect(error).toBeNull();
    expect(newId).toBeTruthy();
    expect(newId).not.toBe(srcColId);

    const { data: copied } = await alice.client.from("collections").select().eq("id", newId).single();
    expect(copied!.space_id).toBe(dstSpaceId);
    expect(copied!.title).toBe("읽을거리");
    expect(copied!.icon).toBe("📚");
    expect(copied!.note).toBe("메모");
    expect(copied!.user_id).toBe(alice.id);

    const { data: links } = await alice.client.from("links")
      .select().eq("collection_id", newId).order("position");
    expect(links!.map((l) => l.url)).toEqual(["https://a.com", "https://b.com"]);
    expect(links![1].note).toBe("b메모");
  });

  it("복사본은 대상 스페이스 맨 아래 position을 받는다", async () => {
    // 대상 스페이스에 position 5000짜리 컬렉션을 먼저 만들어 둔다
    await alice.client.from("collections")
      .insert({ user_id: alice.id, space_id: dstSpaceId, title: "기존", position: 5000 });
    const { data: newId } = await alice.client.rpc("copy_collection", {
      p_collection_id: srcColId, p_target_space_id: dstSpaceId,
    });
    const { data: copied } = await alice.client.from("collections").select().eq("id", newId).single();
    expect(copied!.position).toBeGreaterThan(5000);
  });

  it("복사본을 수정해도 원본은 바뀌지 않는다", async () => {
    const { data: newId } = await alice.client.rpc("copy_collection", {
      p_collection_id: srcColId, p_target_space_id: dstSpaceId,
    });
    await alice.client.from("collections").update({ title: "변경됨" }).eq("id", newId);
    const { data: original } = await alice.client.from("collections").select().eq("id", srcColId).single();
    expect(original!.title).toBe("읽을거리");
  });

  it("남의 컬렉션은 복사할 수 없다", async () => {
    const { error } = await bob.client.rpc("copy_collection", {
      p_collection_id: srcColId, p_target_space_id: bobSpaceId,
    });
    expect(error).not.toBeNull();
  });

  it("남의 스페이스로는 복사할 수 없다", async () => {
    const { error } = await alice.client.rpc("copy_collection", {
      p_collection_id: srcColId, p_target_space_id: bobSpaceId,
    });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

로컬 Supabase가 떠 있어야 한다 (`npx supabase start`, `packages/core/.env.test` 구성 완료 상태).

Run: `pnpm --filter @tablign/core test -- copy-collection`
Expected: FAIL — `Could not find the function public.copy_collection` 류의 에러

- [ ] **Step 3: 마이그레이션 작성**

`supabase/migrations/0006_copy_collection.sql` 생성:

```sql
-- 컬렉션 딥카피 RPC (공유 1단계: 내 스페이스 간 복사)
-- security definer: 이후 공유 코드(2단계)·공유 스페이스(3단계)에서 재사용할 수 있도록
-- 권한 검증을 함수 내부에서 수행한다.
create function public.copy_collection(p_collection_id uuid, p_target_space_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new_id uuid;
  v_next_pos double precision;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- 1단계(개인 전용): 원본 컬렉션의 스페이스와 대상 스페이스 모두 호출자 소유여야 한다.
  -- 3단계(공유 스페이스)에서 has_space_access/can_edit_space 헬퍼 기반으로 교체 예정.
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

  -- 대상 스페이스 맨 아래 position (기존 GAP=1000 규칙)
  select coalesce(max(position), 0) + 1000 into v_next_pos
  from collections where space_id = p_target_space_id;

  insert into collections (space_id, user_id, title, icon, note, position)
  select p_target_space_id, v_uid, title, icon, note, v_next_pos
  from collections where id = p_collection_id
  returning id into v_new_id;

  -- 링크 딥카피: position 유지, user_id는 호출자. 태그는 복사하지 않는다(설계 결정).
  insert into links (collection_id, user_id, url, title, favicon_url, thumbnail_url, custom_title, note, position)
  select v_new_id, v_uid, url, title, favicon_url, thumbnail_url, custom_title, note, position
  from links where collection_id = p_collection_id;

  return v_new_id;
end;
$$;

revoke execute on function public.copy_collection(uuid, uuid) from public, anon;
grant execute on function public.copy_collection(uuid, uuid) to authenticated;
```

- [ ] **Step 4: 마이그레이션 적용 후 테스트 통과 확인**

Run: `npx supabase db reset` (프로젝트 루트에서. 로컬 DB에 0001~0006 재적용)
Run: `pnpm --filter @tablign/core test -- copy-collection`
Expected: PASS (5 tests)

기존 테스트도 깨지지 않았는지 확인:
Run: `pnpm --filter @tablign/core test`
Expected: 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/0006_copy_collection.sql packages/core/src/__tests__/copy-collection.test.ts
git commit -m "feat(db): copy_collection RPC — 컬렉션·링크 딥카피"
```

---

### Task 2: core 데이터 함수 `copyCollection` · `moveCollectionToSpace`

**Files:**
- Modify: `packages/core/src/data/collections.ts` (파일 끝에 함수 2개 추가)
- Test: `packages/core/src/__tests__/copy-collection.test.ts` (describe 블록 추가)

**Interfaces:**
- Consumes: Task 1의 SQL 함수 `copy_collection`, 기존 `updateCollection`(`space_id` patch 지원 확인됨: `collections.ts:53`), `GAP`(`../position`)
- Produces:
  - `copyCollection(client: SupabaseClient, collectionId: string, targetSpaceId: string): Promise<string>` — 새 컬렉션 id 반환
  - `moveCollectionToSpace(client: SupabaseClient, collectionId: string, targetSpaceId: string): Promise<Collection>` — 대상 스페이스 맨 아래로 이동된 컬렉션 반환

  (둘 다 `packages/core/src/index.ts`의 `export * from "./data/collections"`로 자동 노출됨 — index.ts 수정 불필요)

- [ ] **Step 1: 실패하는 테스트 추가**

`copy-collection.test.ts` 파일 끝에 describe 블록 추가 (기존 import에 추가: `import { copyCollection, moveCollectionToSpace } from "../data/collections";`):

```typescript
describe("copyCollection / moveCollectionToSpace (core)", () => {
  it("copyCollection이 새 컬렉션 id를 반환한다", async () => {
    const newId = await copyCollection(alice.client, srcColId, dstSpaceId);
    expect(typeof newId).toBe("string");
    const { data } = await alice.client.from("collections").select().eq("id", newId).single();
    expect(data!.space_id).toBe(dstSpaceId);
  });

  it("moveCollectionToSpace가 컬렉션을 대상 스페이스 맨 아래로 옮긴다", async () => {
    // 이동용 컬렉션을 원본 스페이스에 새로 만든다 (srcColId는 다른 테스트가 쓰므로 건드리지 않음)
    const { data: c } = await alice.client.from("collections")
      .insert({ user_id: alice.id, space_id: srcSpaceId, title: "이동할 것", position: 1000 })
      .select().single();
    // 대상 스페이스의 현재 최대 position 파악
    const { data: before } = await alice.client.from("collections")
      .select("position").eq("space_id", dstSpaceId)
      .order("position", { ascending: false }).limit(1);
    const maxBefore = before?.[0]?.position ?? 0;

    const moved = await moveCollectionToSpace(alice.client, c!.id, dstSpaceId);
    expect(moved.space_id).toBe(dstSpaceId);
    expect(moved.position).toBeGreaterThan(maxBefore);

    // 원본 스페이스에서는 사라진다
    const { data: remain } = await alice.client.from("collections")
      .select().eq("space_id", srcSpaceId).eq("id", c!.id);
    expect(remain).toHaveLength(0);
    // 링크는 컬렉션을 따라간다 (collection_id 불변이므로 자동)
  });
});
```

주의: `alice`, `srcColId`, `dstSpaceId`, `srcSpaceId`는 Task 1의 최상위 `describe` 스코프에 있으므로, 두 describe가 공유하도록 변수 선언과 `beforeAll`을 파일 최상위로 끌어올린다(테스트 파일 구조만 조정, 내용 동일).

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @tablign/core test -- copy-collection`
Expected: FAIL — `copyCollection is not a function` (모듈에 없음)

- [ ] **Step 3: 구현**

`packages/core/src/data/collections.ts` — 파일 상단 import에 `GAP` 추가, 파일 끝에 함수 2개 추가:

```typescript
import { GAP } from "../position";
```

```typescript
/** 컬렉션을 대상 스페이스로 딥카피(링크 포함, 태그 제외)하고 새 컬렉션 id를 반환한다. */
export async function copyCollection(
  client: SupabaseClient,
  collectionId: string,
  targetSpaceId: string,
): Promise<string> {
  const { data, error } = await client.rpc("copy_collection", {
    p_collection_id: collectionId,
    p_target_space_id: targetSpaceId,
  });
  if (error) throw error;
  return data as string;
}

/** 컬렉션을 대상 스페이스 맨 아래로 이동한다(링크는 collection_id 기준이라 자동으로 따라감). */
export async function moveCollectionToSpace(
  client: SupabaseClient,
  collectionId: string,
  targetSpaceId: string,
): Promise<Collection> {
  const { data: last, error } = await client
    .from("collections")
    .select("position")
    .eq("space_id", targetSpaceId)
    .order("position", { ascending: false })
    .limit(1);
  if (error) throw error;
  const position = (last?.[0]?.position ?? 0) + GAP;
  return updateCollection(client, collectionId, { space_id: targetSpaceId, position });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @tablign/core test`
Expected: 전부 PASS (신규 2개 포함)

Run: `pnpm --filter @tablign/core lint`
Expected: 에러 없음 (tsc --noEmit)

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/data/collections.ts packages/core/src/__tests__/copy-collection.test.ts
git commit -m "feat(core): copyCollection·moveCollectionToSpace 추가"
```

---

### Task 3: UI — `CollectionMoreMenu` 팝오버 + `CollectionSection` 슬롯

**Files:**
- Create: `packages/ui/src/CollectionMoreMenu.tsx`
- Modify: `packages/ui/src/icons.ts` (`MoreHorizontal`, `ArrowLeft` re-export 추가)
- Modify: `packages/ui/src/index.ts` (`export * from "./CollectionMoreMenu";` 추가)
- Modify: `packages/ui/src/CollectionSection.tsx` (`moreMenuSlot` prop 추가)
- Test: `packages/ui/src/__tests__/CollectionMoreMenu.test.tsx` (새 파일)

**Interfaces:**
- Produces:
  ```typescript
  export interface SpaceOption { id: string; name: string; icon?: string | null }
  export interface CollectionMoreMenuProps {
    spaces: SpaceOption[];            // 현재 스페이스를 제외한 대상 스페이스 목록
    onMove: (spaceId: string) => void;
    onCopy: (spaceId: string) => void;
  }
  export function CollectionMoreMenu(props: CollectionMoreMenuProps): JSX.Element
  ```
  `CollectionSectionProps`에 `moreMenuSlot?: ReactNode` 추가 — 헤더 우측 버튼 그룹(링크 추가 버튼 앞)에 렌더.

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/ui/src/__tests__/CollectionMoreMenu.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CollectionMoreMenu } from "../CollectionMoreMenu";

const spaces = [
  { id: "s1", name: "스터디", icon: null },
  { id: "s2", name: "업무", icon: "💼" },
];

function noop() {}

describe("CollectionMoreMenu", () => {
  it("메뉴 버튼을 누르면 이동/복사 항목이 보인다", () => {
    render(<CollectionMoreMenu spaces={spaces} onMove={noop} onCopy={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 메뉴" }));
    expect(screen.getByText("다른 스페이스로 이동")).toBeInTheDocument();
    expect(screen.getByText("다른 스페이스에 복사")).toBeInTheDocument();
  });

  it("이동 → 스페이스 선택 시 onMove(spaceId)를 호출하고 닫힌다", () => {
    const onMove = vi.fn();
    render(<CollectionMoreMenu spaces={spaces} onMove={onMove} onCopy={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 메뉴" }));
    fireEvent.click(screen.getByText("다른 스페이스로 이동"));
    fireEvent.click(screen.getByText("스터디"));
    expect(onMove).toHaveBeenCalledWith("s1");
    expect(screen.queryByText("스터디")).not.toBeInTheDocument(); // 팝오버 닫힘
  });

  it("복사 → 스페이스 선택 시 onCopy(spaceId)를 호출한다", () => {
    const onCopy = vi.fn();
    render(<CollectionMoreMenu spaces={spaces} onMove={noop} onCopy={onCopy} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 메뉴" }));
    fireEvent.click(screen.getByText("다른 스페이스에 복사"));
    fireEvent.click(screen.getByText("업무"));
    expect(onCopy).toHaveBeenCalledWith("s2");
  });

  it("뒤로 버튼으로 첫 메뉴로 돌아간다", () => {
    render(<CollectionMoreMenu spaces={spaces} onMove={noop} onCopy={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "컬렉션 메뉴" }));
    fireEvent.click(screen.getByText("다른 스페이스로 이동"));
    fireEvent.click(screen.getByRole("button", { name: "뒤로" }));
    expect(screen.getByText("다른 스페이스에 복사")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @tablign/ui test -- CollectionMoreMenu`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`packages/ui/src/icons.ts`의 export 목록에 두 줄 추가:

```typescript
  MoreHorizontal,
  ArrowLeft,
```

`packages/ui/src/CollectionMoreMenu.tsx` 생성:

```tsx
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, ArrowLeft } from "./icons";
import { theme } from "./theme";

export interface SpaceOption { id: string; name: string; icon?: string | null }

export interface CollectionMoreMenuProps {
  /** 현재 스페이스를 제외한 이동/복사 대상 스페이스 목록 */
  spaces: SpaceOption[];
  onMove: (spaceId: string) => void;
  onCopy: (spaceId: string) => void;
}

/** 컬렉션 헤더의 ⋯ 메뉴. 이동/복사 → 스페이스 선택 2단계 팝오버. */
export function CollectionMoreMenu({ spaces, onMove, onCopy }: CollectionMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"move" | "copy" | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);

  // 바깥 클릭으로 닫기
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function close() { setOpen(false); setMode(null); }
  function pick(spaceId: string) {
    (mode === "move" ? onMove : onCopy)(spaceId);
    close();
  }

  return (
    <span ref={rootRef} style={{ position: "relative", display: "flex" }}>
      <button
        type="button"
        title="컬렉션 메뉴"
        aria-label="컬렉션 메뉴"
        onClick={() => (open ? close() : setOpen(true))}
        style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 3, borderRadius: 6 }}
      >
        <MoreHorizontal size={15} color={theme.textMuted} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "100%", right: 0, marginTop: 4, zIndex: 50, minWidth: 168,
            background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 10,
            boxShadow: "0 8px 20px rgba(20,30,60,.14)", padding: 4,
          }}
        >
          {mode === null ? (
            <>
              <button type="button" style={itemStyle} onClick={() => setMode("move")}>다른 스페이스로 이동</button>
              <button type="button" style={itemStyle} onClick={() => setMode("copy")}>다른 스페이스에 복사</button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 6px", color: theme.textFaint, fontSize: 12 }}>
                <button
                  type="button"
                  title="뒤로"
                  aria-label="뒤로"
                  onClick={() => setMode(null)}
                  style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 2 }}
                >
                  <ArrowLeft size={13} color={theme.textFaint} />
                </button>
                {mode === "move" ? "이동할 스페이스" : "복사할 스페이스"}
              </div>
              {spaces.map((s) => (
                <button key={s.id} type="button" style={itemStyle} onClick={() => pick(s.id)}>
                  {s.icon ? `${s.icon} ` : ""}{s.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </span>
  );
}

const itemStyle: React.CSSProperties = {
  display: "block", width: "100%", textAlign: "left", border: "none", background: "none",
  cursor: "pointer", padding: "7px 9px", borderRadius: 7, fontSize: 13, color: theme.text,
};
```

`packages/ui/src/index.ts`에 추가:

```typescript
export * from "./CollectionMoreMenu";
```

`packages/ui/src/CollectionSection.tsx` 수정 — props 인터페이스에 추가:

```typescript
  /** 제공되면 헤더 우측 버튼 그룹에 ⋯ 메뉴를 렌더(확장의 이동/복사 메뉴 주입용) */
  moreMenuSlot?: ReactNode;
```

함수 시그니처의 구조 분해에 `moreMenuSlot` 추가하고, 헤더의 버튼 그룹(`<span style={{ marginLeft: "auto", ... }}>` 내부, "링크 추가" 버튼 앞)에 렌더:

```tsx
        <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
          {moreMenuSlot}
          <button type="button" title="링크 추가" ...>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @tablign/ui test`
Expected: 전부 PASS (기존 CollectionSection 테스트 포함)

Run: `pnpm --filter @tablign/ui lint`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add packages/ui/src/CollectionMoreMenu.tsx packages/ui/src/icons.ts packages/ui/src/index.ts packages/ui/src/CollectionSection.tsx packages/ui/src/__tests__/CollectionMoreMenu.test.tsx
git commit -m "feat(ui): 컬렉션 ⋯ 메뉴(이동/복사 스페이스 선택 팝오버)"
```

---

### Task 4: 확장 연결 — NewTab 핸들러 + ToastProvider

**Files:**
- Modify: `apps/extension/src/newtab/main.tsx` (ToastProvider 마운트)
- Modify: `apps/extension/src/newtab/NewTab.tsx` (핸들러 + 슬롯 주입)

**Interfaces:**
- Consumes: `copyCollection`·`moveCollectionToSpace`(Task 2, `@tablign/core`), `CollectionMoreMenu`·`ToastProvider`·`useToast`(Task 3 및 기존, `@tablign/ui`)
- Produces: 사용자 기능 완성 (외부에 노출하는 인터페이스 없음)

- [ ] **Step 1: ToastProvider 마운트**

`apps/extension/src/newtab/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import { ToastProvider } from "@tablign/ui";
import { NewTab } from "./NewTab";

createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <NewTab />
  </ToastProvider>,
);
```

- [ ] **Step 2: NewTab에 핸들러 추가 + 슬롯 주입**

`apps/extension/src/newtab/NewTab.tsx` 수정.

import 추가 (기존 `@tablign/core` import에 `copyCollection`, `moveCollectionToSpace` 추가, `@tablign/ui` import에 `CollectionMoreMenu`, `useToast` 추가).

`NewTab` 컴포넌트 본문에 (기존 `addCollection` 함수 근처):

```tsx
  const toast = useToast();

  // 이동: 현재 스페이스 목록에서 사라지므로 재조회. 복사: 다른 스페이스에 생기므로 재조회 불필요.
  async function moveCollectionTo(collection: Collection, targetSpaceId: string) {
    await moveCollectionToSpace(supabase, collection.id, targetSpaceId);
    const name = spaces.find((s) => s.id === targetSpaceId)?.name ?? "";
    toast.show(`'${collection.title}' 컬렉션을 '${name}' 스페이스로 이동했어요`);
    loadCollections();
  }

  async function copyCollectionTo(collection: Collection, targetSpaceId: string) {
    await copyCollection(supabase, collection.id, targetSpaceId);
    const name = spaces.find((s) => s.id === targetSpaceId)?.name ?? "";
    toast.show(`'${collection.title}' 컬렉션을 '${name}' 스페이스에 복사했어요`);
  }
```

`CollectionSection` 렌더부(약 558행)에 prop 추가 — 다른 스페이스가 없으면 슬롯을 넘기지 않아 ⋯ 버튼 자체가 안 보인다:

```tsx
  moreMenuSlot={
    spaces.some((s) => s.id !== activeSpaceId) ? (
      <CollectionMoreMenu
        spaces={spaces
          .filter((s) => s.id !== activeSpaceId)
          .map((s) => ({ id: s.id, name: s.name, icon: s.icon }))}
        onMove={(sid) => moveCollectionTo(c, sid)}
        onCopy={(sid) => copyCollectionTo(c, sid)}
      />
    ) : undefined
  }
```

- [ ] **Step 3: 타입·테스트·빌드 확인**

Run: `pnpm --filter @tablign/extension lint && pnpm --filter @tablign/extension test && pnpm --filter @tablign/extension build`
Expected: 전부 통과

Run: `pnpm test` (루트 — 전 패키지)
Expected: 전부 PASS

- [ ] **Step 4: 수동 검증 (크롬에서)**

1. `pnpm --filter @tablign/extension build` 후 `chrome://extensions`에서 dist 재로드, 새 탭 열기
2. 스페이스가 2개 이상인 상태에서 컬렉션 헤더에 ⋯ 버튼이 보이는지
3. ⋯ → "다른 스페이스에 복사" → 스페이스 선택 → 토스트 확인 → 해당 스페이스로 전환해 복사본(링크 포함) 확인
4. ⋯ → "다른 스페이스로 이동" → 현재 보드에서 사라지고 대상 스페이스 맨 아래에 나타나는지
5. 스페이스가 1개뿐이면 ⋯ 버튼이 안 보이는지

- [ ] **Step 5: 커밋**

```bash
git add apps/extension/src/newtab/main.tsx apps/extension/src/newtab/NewTab.tsx
git commit -m "feat(extension): 컬렉션 이동/복사 메뉴 연결 + 토스트"
```
