# 북마크 가져오기(마이그레이션) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chrome 북마크를 tablign의 스페이스·컬렉션·링크로 옮기는 가져오기 기능. 사용자는 폴더를 켜고 끄면서 **만들어질 결과를 실시간으로 미리 보고** 확정한다.

**Architecture:** 매핑 규칙을 부수효과 없는 순수 함수 `planImport(roots, config) → ImportPlan`으로 뽑아 `@tablign/core`에 둔다. 미리보기 UI와 실제 삽입이 **같은 함수의 결과**를 쓰므로 화면이 거짓말할 수 없다. 삽입은 `import_bookmarks(p_org_id, p_payload jsonb)` RPC 하나로 단일 트랜잭션 처리한다(기존 `copy_collection` 패턴). Chrome 의존은 `fromChromeTree`에만 격리해서, 후속 Toby 작업이 `SourceNode[]`로만 정규화하면 같은 계획·삽입 경로를 그대로 탄다.

**Tech Stack:** TypeScript, React 18, Vitest(+ @testing-library/react), pnpm 워크스페이스(`@tablign/core`·`@tablign/ui`·`apps/extension`), Supabase(Postgres RPC + RLS), Chrome Extension MV3.

**설계 문서:** `docs/superpowers/specs/2026-07-31-bookmark-import-design.md`

## Global Constraints

- **커밋 메시지는 저장소 컨벤션 `[타입] 명사형`** 사용(예: `[기능] 북마크 가져오기 계획 함수`). `feat(scope):` 금지.
- **폴더 직속 링크가 모이는 컬렉션 이름은 정확히 `공유 폴더`** — 상수 `SHARED_COLLECTION_TITLE`로 한 곳에만 둔다.
- **컬렉션 이름 합침 구분자는 `/`** — 스페이스 폴더 기준 상대 경로 전체(`React/Hooks/고급`).
- **URL 정규화는 `#프래그먼트` 제거 + 경로 끝 슬래시 제거까지만.** 쿼리스트링(`?utm_source=` 등)·스킴은 건드리지 않는다.
- **DB에 저장하는 `url`은 원본 그대로.** 정규화 결과는 중복 판정 키로만 쓴다.
- **중복 비교 범위는 이번 계획 안.** tablign에 이미 저장된 링크와는 비교하지 않는다.
- **`http:`/`https:`가 아닌 북마크는 가져오지 않는다**(`javascript:` 북마클릿, `chrome://` 등). `fromChromeTree` 단계에서 걸러내므로 트리의 링크 개수에도 애초에 세지 않는다.
- **파비콘은 `new URL(url).origin + "/favicon.ico"`.** 외부 서비스를 거치지 않는다.
- **`position`은 순서대로 `(i + 1) * GAP`**, `GAP = 1000`(`packages/core/src/position.ts`).
- **링크 상한 2000개** — 상수 `MAX_IMPORT_LINKS`. 초과 시 가져오기 버튼 비활성.
- **큰 폴더 기준 100개** — 상수 `LARGE_FOLDER_THRESHOLD`. 1단 폴더의 자손 포함 총 링크 수가 이 값을 넘으면 기본 해제.
- **`bookmarks`는 필수 권한**(`optional_permissions` 아님). Chrome 북마크는 **읽기만** 한다 — 생성·수정·삭제 코드를 만들지 않는다.
- 컬렉션 `is_private`는 기본값 `false`(명시 지정하지 않음). 태그는 다루지 않는다.
- UI 문구는 해요체, 개수는 고정폭(`ui-monospace`) + `tabular-nums`.
- 테스트 실행: `pnpm --filter @tablign/core test`, `pnpm --filter @tablign/ui test`, `pnpm --filter @tablign/extension test`. RPC 테스트는 `packages/core/.env.test`의 원격 Supabase를 쓴다(마이그레이션은 `supabase db push` 선행).

---

## File Structure

**신규**

- `packages/core/src/import/types.ts` — 가져오기 공통 타입(`SourceNode`, `ImportPlan` 등). 브라우저 API 의존 없음.
- `packages/core/src/import/url.ts` — `normalizeUrl`, `faviconFor`. 순수 함수.
- `packages/core/src/import/plan.ts` — `planImport`, `defaultEnabled`, `countLinks`, 상수. 순수 함수.
- `packages/core/src/import/chrome.ts` — `fromChromeTree`: Chrome 북마크 트리 → `SourceNode[]`. Chrome 의존이 격리되는 유일한 파일.
- `packages/core/src/data/import.ts` — `importBookmarks` RPC 래퍼.
- `packages/core/src/__tests__/import-url.test.ts` — `normalizeUrl`·`faviconFor` 단위테스트.
- `packages/core/src/__tests__/import-plan.test.ts` — `planImport`·`defaultEnabled` 단위테스트. **이 설계에서 깨질 수 있는 곳은 거의 전부 여기다.**
- `packages/core/src/__tests__/import-chrome.test.ts` — `fromChromeTree` 단위테스트.
- `packages/core/src/__tests__/import-bookmarks.test.ts` — RPC 통합테스트(RLS·position·거부).
- `supabase/migrations/0024_import_bookmarks.sql` — `import_bookmarks` RPC.
- `packages/ui/src/ImportBookmarksDialog.tsx` — 2단 미리보기 다이얼로그. `SourceNode[]`를 받아 내부에서 `planImport`를 돌리고 그리기만 한다.
- `packages/ui/src/__tests__/ImportBookmarksDialog.test.tsx` — 상호작용 테스트.

**수정**

- `packages/core/src/index.ts` — `import/*`·`data/import` export 추가.
- `packages/ui/src/index.ts` — `ImportBookmarksDialog` export 추가.
- `packages/ui/src/SpaceOnboarding.tsx` — `onImport?` prop 추가, CTA 아래 보조 행동 노출.
- `apps/extension/public/manifest.json` — `permissions`에 `"bookmarks"` 추가.
- `apps/extension/src/newtab/OrgHeader.tsx` — `onImport?` prop 추가, 메뉴 첫 항목 `가져오기`.
- `apps/extension/src/newtab/NewTab.tsx` — 다이얼로그 상태·트리 로드·조직 목록·RPC 호출·토스트·이동 배선.
- `apps/extension/src/newtab/NewTab.test.tsx` — 가져오기 경로 테스트 추가.

`plan.ts`가 브라우저 API를 모르는 것이 이 구조의 핵심이다. 그래서 규칙 검증이 순수 함수 테스트로 끝나고, Toby는 파서만 추가하면 된다.

---

### Task 1: URL 정규화와 파비콘 생성

중복 판정 키와 파비콘 주소를 만드는 순수 함수. 뒤의 모든 태스크가 이것에 의존하므로 먼저 못 박는다.

**Files:**
- Create: `packages/core/src/import/url.ts`
- Test: `packages/core/src/__tests__/import-url.test.ts`

**Interfaces:**
- Consumes: 없음(표준 `URL`만 사용).
- Produces:
  - `normalizeUrl(raw: string): string` — 중복 판정 키. 파싱 실패 시 원문 반환.
  - `faviconFor(raw: string): string | null` — `origin + "/favicon.ico"`. http/https가 아니거나 파싱 실패면 `null`.
  - `isImportableUrl(raw: string): boolean` — `http:`/`https:`만 `true`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/import-url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeUrl, faviconFor, isImportableUrl } from "../import/url";

describe("normalizeUrl", () => {
  it("프래그먼트를 제거한다", () => {
    expect(normalizeUrl("https://react.dev/learn#state")).toBe("https://react.dev/learn");
  });
  it("경로 끝 슬래시를 제거한다", () => {
    expect(normalizeUrl("https://react.dev/learn/")).toBe("https://react.dev/learn");
  });
  it("루트 경로의 슬래시는 남긴다", () => {
    expect(normalizeUrl("https://react.dev/")).toBe("https://react.dev/");
  });
  it("쿼리스트링은 건드리지 않는다", () => {
    expect(normalizeUrl("https://a.com/b?utm_source=x")).toBe("https://a.com/b?utm_source=x");
  });
  it("쿼리가 다르면 다른 키다", () => {
    expect(normalizeUrl("https://a.com/b?x=1")).not.toBe(normalizeUrl("https://a.com/b?x=2"));
  });
  it("프래그먼트만 다른 두 주소는 같은 키가 된다", () => {
    expect(normalizeUrl("https://a.com/b#one")).toBe(normalizeUrl("https://a.com/b#two"));
  });
  it("파싱할 수 없는 값은 원문을 그대로 키로 쓴다", () => {
    expect(normalizeUrl("완전히 주소가 아님")).toBe("완전히 주소가 아님");
  });
});

describe("faviconFor", () => {
  it("origin 기준 favicon.ico를 만든다", () => {
    expect(faviconFor("https://react.dev/learn/state")).toBe("https://react.dev/favicon.ico");
  });
  it("포트가 있으면 origin에 포함된다", () => {
    expect(faviconFor("http://localhost:5173/a")).toBe("http://localhost:5173/favicon.ico");
  });
  it("http·https가 아니면 null", () => {
    expect(faviconFor("javascript:alert(1)")).toBeNull();
    expect(faviconFor("chrome://bookmarks")).toBeNull();
  });
  it("파싱 실패면 null", () => {
    expect(faviconFor("주소 아님")).toBeNull();
  });
});

describe("isImportableUrl", () => {
  it("http·https만 통과한다", () => {
    expect(isImportableUrl("https://a.com")).toBe(true);
    expect(isImportableUrl("http://a.com")).toBe(true);
    expect(isImportableUrl("javascript:void(0)")).toBe(false);
    expect(isImportableUrl("chrome://newtab")).toBe(false);
    expect(isImportableUrl("file:///Users/a.pdf")).toBe(false);
    expect(isImportableUrl("주소 아님")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tablign/core test import-url`
Expected: FAIL — `Failed to resolve import "../import/url"`

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/import/url.ts`:

```ts
/**
 * 중복 판정에 쓰는 정규화 키.
 * 프래그먼트와 경로 끝 슬래시만 접는다 — 쿼리스트링까지 건드리면 사용자가
 * 의도적으로 다르게 저장한 링크가 합쳐진다.
 * DB에 저장하는 url은 항상 원본이고, 이 값은 키로만 쓴다.
 */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return raw;
  }
}

/** 탭으로 열 수 있는 주소만 가져온다. 북마클릿(javascript:)·chrome:// 등은 제외. */
export function isImportableUrl(raw: string): boolean {
  try {
    const p = new URL(raw).protocol;
    return p === "http:" || p === "https:";
  } catch {
    return false;
  }
}

/**
 * Chrome 북마크 API는 파비콘을 주지 않는다. 대부분의 사이트가 origin 루트에
 * favicon.ico를 두고, 없는 사이트는 Favicon 컴포넌트의 onError가 지구본으로 떨어뜨린다.
 */
export function faviconFor(raw: string): string | null {
  if (!isImportableUrl(raw)) return null;
  try {
    return new URL(raw).origin + "/favicon.ico";
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tablign/core test import-url`
Expected: PASS (전체 통과)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/import/url.ts packages/core/src/__tests__/import-url.test.ts
git commit -m "[기능] 북마크 가져오기 URL 정규화·파비콘 유틸"
```

---

### Task 2: 가져오기 타입과 `planImport`

매핑 규칙 전체. 스펙 §2의 규칙 1~10을 이 함수 하나가 구현한다. UI·RPC가 전부 이 결과만 보므로, 여기가 맞으면 나머지는 그리기와 삽입뿐이다.

**Files:**
- Create: `packages/core/src/import/types.ts`, `packages/core/src/import/plan.ts`
- Test: `packages/core/src/__tests__/import-plan.test.ts`

**Interfaces:**
- Consumes: `normalizeUrl`, `faviconFor` from `packages/core/src/import/url.ts` (Task 1).
- Produces:
  - `SHARED_COLLECTION_TITLE = "공유 폴더"`, `MAX_IMPORT_LINKS = 2000`, `LARGE_FOLDER_THRESHOLD = 100`
  - `looseSourceId(rootId: string): string` — 루트 직속 링크 묶음의 합성 id (`"<rootId>:loose"`)
  - `countLinks(node: SourceNode): number` — 자손 포함 링크 수
  - `planImport(roots: SourceNode[], config: ImportConfig): ImportPlan`
  - 타입 `SourceNode`, `ImportConfig`, `PlannedLink`, `PlannedCollection`, `PlannedSpace`, `ImportPlan`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/import-plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planImport, looseSourceId, countLinks, SHARED_COLLECTION_TITLE } from "../import/plan";
import type { SourceNode, ImportConfig } from "../import/types";

/** 모든 폴더를 켠 config. 테스트에서 명시적으로 끄고 싶은 것만 덮어쓴다. */
function allOn(roots: SourceNode[], overrides: Record<string, boolean> = {}): ImportConfig {
  const enabled: Record<string, boolean> = {};
  const walk = (n: SourceNode) => {
    if (n.url === undefined) enabled[n.id] = true;
    (n.children ?? []).forEach(walk);
  };
  for (const r of roots) {
    (r.children ?? []).forEach(walk);
    enabled[looseSourceId(r.id)] = true;
  }
  return { enabled: { ...enabled, ...overrides } };
}

const link = (id: string, url: string, title = id): SourceNode => ({ id, title, url });

/** 스펙의 예시 트리. 3단 중첩·평탄 폴더·직속 링크 혼재·루트 직속 링크를 모두 포함한다. */
function tree(): SourceNode[] {
  return [
    {
      id: "1", title: "북마크바", primary: true, children: [
        {
          id: "dev", title: "개발", children: [
            { id: "react", title: "React", children: [
              link("r1", "https://react.dev/a"),
              { id: "hooks", title: "Hooks", children: [link("h1", "https://react.dev/hooks")] },
            ]},
            { id: "node", title: "Node", children: [link("n1", "https://nodejs.org/a")] },
            link("d1", "https://dev.local/direct"),
          ],
        },
        { id: "news", title: "뉴스", children: [link("w1", "https://news.local/a")] },
        { id: "empty", title: "빈폴더", children: [] },
        link("root1", "https://loose.local/a"),
      ],
    },
    {
      id: "2", title: "기타 북마크", children: [
        { id: "tmp", title: "임시", children: [link("t1", "https://tmp.local/a")] },
      ],
    },
  ];
}

describe("planImport", () => {
  it("1단 폴더가 스페이스, 안쪽 폴더가 컬렉션이 된다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots));
    const dev = plan.spaces.find((s) => s.sourceId === "dev")!;
    expect(dev.name).toBe("개발");
    expect(dev.collections.map((c) => c.title)).toEqual(["React", "React/Hooks", "Node", SHARED_COLLECTION_TITLE]);
  });

  it("깊이 3 이상은 부모/자식으로 이름을 합치고 synthetic으로 표시한다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots));
    const dev = plan.spaces.find((s) => s.sourceId === "dev")!;
    const react = dev.collections.find((c) => c.sourceId === "react")!;
    const hooks = dev.collections.find((c) => c.sourceId === "hooks")!;
    expect(react.title).toBe("React");
    expect(react.synthetic).toBe(false);
    expect(hooks.title).toBe("React/Hooks");
    expect(hooks.synthetic).toBe(true);
  });

  it("폴더 직속 링크는 공유 폴더 컬렉션으로 맨 뒤에 모인다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots));
    const dev = plan.spaces.find((s) => s.sourceId === "dev")!;
    const shared = dev.collections.at(-1)!;
    expect(shared.title).toBe(SHARED_COLLECTION_TITLE);
    expect(shared.synthetic).toBe(true);
    expect(shared.links.map((l) => l.url)).toEqual(["https://dev.local/direct"]);
  });

  it("직속 링크가 없으면 공유 폴더를 만들지 않는다", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "a", title: "A", children: [{ id: "b", title: "B", children: [link("l", "https://a.com/1")] }] },
    ]}];
    const plan = planImport(roots, allOn(roots));
    expect(plan.spaces[0].collections.map((c) => c.title)).toEqual(["B"]);
  });

  it("하위 폴더 없이 링크만 든 1단 폴더도 스페이스가 되고 공유 폴더 하나를 갖는다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots));
    const news = plan.spaces.find((s) => s.sourceId === "news")!;
    expect(news.name).toBe("뉴스");
    expect(news.collections).toHaveLength(1);
    expect(news.collections[0].title).toBe(SHARED_COLLECTION_TITLE);
  });

  it("루트 직속 링크는 루트 이름의 스페이스로 들어간다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots));
    const loose = plan.spaces.find((s) => s.sourceId === looseSourceId("1"))!;
    expect(loose.name).toBe("북마크바");
    expect(loose.collections[0].title).toBe(SHARED_COLLECTION_TITLE);
    expect(loose.collections[0].links.map((l) => l.url)).toEqual(["https://loose.local/a"]);
  });

  it("링크 0개 컬렉션과 컬렉션 0개 스페이스는 계획에 넣지 않는다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots));
    expect(plan.spaces.map((s) => s.sourceId)).not.toContain("empty");
  });

  it("꺼진 폴더는 계획에서 빠지고 그 링크는 다른 폴더의 중복 판정에도 쓰이지 않는다", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "a", title: "A", children: [link("l1", "https://same.com/x")] },
      { id: "b", title: "B", children: [link("l2", "https://same.com/x")] },
    ]}];
    const plan = planImport(roots, allOn(roots, { a: false }));
    const b = plan.spaces.find((s) => s.sourceId === "b")!;
    // A가 꺼졌으니 URL을 선점하지 않는다 — B가 온전히 가져간다
    expect(b.collections[0].links).toHaveLength(1);
    expect(b.collections[0].duplicatesDropped).toBe(0);
  });

  it("같은 URL은 순회 순서상 처음 만난 것만 남고 나머지는 duplicatesDropped로 센다", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "a", title: "A", children: [link("l1", "https://same.com/x"), link("l2", "https://a.com/1")] },
      { id: "b", title: "B", children: [link("l3", "https://same.com/x#frag"), link("l4", "https://b.com/1")] },
    ]}];
    const plan = planImport(roots, allOn(roots));
    const a = plan.spaces.find((s) => s.sourceId === "a")!.collections[0];
    const b = plan.spaces.find((s) => s.sourceId === "b")!.collections[0];
    expect(a.links).toHaveLength(2);
    expect(a.duplicatesDropped).toBe(0);
    expect(b.links.map((l) => l.url)).toEqual(["https://b.com/1"]);
    expect(b.duplicatesDropped).toBe(1);
  });

  it("저장하는 url은 원본이고 정규화 결과가 아니다", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "a", title: "A", children: [link("l1", "https://a.com/b/?x=1#top")] },
    ]}];
    const plan = planImport(roots, allOn(roots));
    expect(plan.spaces[0].collections[0].links[0].url).toBe("https://a.com/b/?x=1#top");
  });

  it("파비콘을 링크마다 채운다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots));
    const react = plan.spaces.find((s) => s.sourceId === "dev")!.collections[0];
    expect(react.links[0].favicon_url).toBe("https://react.dev/favicon.ico");
  });

  it("제목이 빈 문자열이면 null로 둔다", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "a", title: "A", children: [{ id: "l", title: "", url: "https://a.com/1" }] },
    ]}];
    const plan = planImport(roots, allOn(roots));
    expect(plan.spaces[0].collections[0].links[0].title).toBeNull();
  });

  it("totals가 실제 계획과 일치한다", () => {
    const roots = tree();
    const plan = planImport(roots, allOn(roots));
    const cols = plan.spaces.flatMap((s) => s.collections);
    expect(plan.totals.spaces).toBe(plan.spaces.length);
    expect(plan.totals.collections).toBe(cols.length);
    expect(plan.totals.links).toBe(cols.reduce((n, c) => n + c.links.length, 0));
    expect(plan.totals.duplicates).toBe(cols.reduce((n, c) => n + c.duplicatesDropped, 0));
  });
});

describe("countLinks", () => {
  it("자손을 포함해 링크를 센다", () => {
    const dev = tree()[0].children![0];
    expect(countLinks(dev)).toBe(4); // r1, h1, n1, d1
  });
  it("링크가 없으면 0", () => {
    expect(countLinks({ id: "x", title: "x", children: [] })).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tablign/core test import-plan`
Expected: FAIL — `Failed to resolve import "../import/plan"`

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/import/types.ts`:

```ts
/** 소스(Chrome·Toby) 트리를 정규화한 공통 형태. url이 있으면 링크, 없으면 폴더. */
export interface SourceNode {
  id: string;
  title: string;
  url?: string;
  children?: SourceNode[];
  /** 루트 노드에만 씀. 사용자가 매일 보는 루트(Chrome의 북마크바)인지. 기본 선택값 계산에 쓴다. */
  primary?: boolean;
}

export interface ImportConfig {
  /** 폴더 id(및 루트 직속 묶음 id) → 가져올지. defaultEnabled()가 초기값을 만든다. */
  enabled: Record<string, boolean>;
}

export interface PlannedLink {
  url: string;
  title: string | null;
  favicon_url: string | null;
}

export interface PlannedCollection {
  /** 출처 폴더 id. 공유 폴더면 그 스페이스 폴더(또는 루트 직속 묶음) id. */
  sourceId: string;
  title: string;
  /** 원본에 없던, 가져오기가 만들어낸 컬렉션(공유 폴더 / 이름 합침) */
  synthetic: boolean;
  links: PlannedLink[];
  /** 중복으로 버려진 개수. UI의 −n 배지. */
  duplicatesDropped: number;
}

export interface PlannedSpace {
  sourceId: string;
  name: string;
  collections: PlannedCollection[];
}

export interface ImportPlan {
  spaces: PlannedSpace[];
  totals: { spaces: number; collections: number; links: number; duplicates: number };
}
```

Create `packages/core/src/import/plan.ts`:

```ts
import { faviconFor, normalizeUrl } from "./url";
import type {
  ImportConfig, ImportPlan, PlannedCollection, PlannedLink, PlannedSpace, SourceNode,
} from "./types";

export type {
  ImportConfig, ImportPlan, PlannedCollection, PlannedLink, PlannedSpace, SourceNode,
};

/** 폴더에 직접 들어있던 링크가 모이는 컬렉션 이름. */
export const SHARED_COLLECTION_TITLE = "공유 폴더";
/** 한 번에 가져올 수 있는 링크 상한. */
export const MAX_IMPORT_LINKS = 2000;
/** 이 개수를 넘는 1단 폴더는 기본 해제("나중에 읽기" 같은 묘지). */
export const LARGE_FOLDER_THRESHOLD = 100;

/** 루트 직속 링크 묶음은 실제 폴더가 아니므로 합성 id를 쓴다. */
export function looseSourceId(rootId: string): string {
  return `${rootId}:loose`;
}

/** 자손을 포함한 링크 수. */
export function countLinks(node: SourceNode): number {
  let n = 0;
  for (const c of node.children ?? []) {
    if (c.url !== undefined) n += 1;
    else n += countLinks(c);
  }
  return n;
}

const isFolder = (n: SourceNode) => n.url === undefined;

/** 폴더의 직속 링크를 가져오며 중복을 소비한다. seen에 이미 있으면 버리고 센다. */
function takeLinks(folder: SourceNode, seen: Set<string>): { links: PlannedLink[]; dropped: number } {
  const links: PlannedLink[] = [];
  let dropped = 0;
  for (const child of folder.children ?? []) {
    if (child.url === undefined) continue;
    const key = normalizeUrl(child.url);
    if (seen.has(key)) { dropped += 1; continue; }
    seen.add(key);
    links.push({ url: child.url, title: child.title || null, favicon_url: faviconFor(child.url) });
  }
  return { links, dropped };
}

/**
 * 스페이스 폴더 하나가 갖게 될 컬렉션들.
 * 직속 링크(공유 폴더)를 먼저 선점하고, 자손 폴더를 깊이 우선으로 훑는다.
 * 출력 순서는 자손 폴더들 → 공유 폴더(맨 뒤)다.
 */
function collectCollections(
  spaceFolder: SourceNode, seen: Set<string>, config: ImportConfig,
): PlannedCollection[] {
  const own = takeLinks(spaceFolder, seen);
  const out: PlannedCollection[] = [];

  const walk = (folder: SourceNode, prefix: string) => {
    for (const child of folder.children ?? []) {
      if (!isFolder(child)) continue;
      // 스페이스 폴더 기준 상대 경로 전체 — 경로는 유일하므로 이름이 충돌하지 않는다
      const title = prefix ? `${prefix}/${child.title}` : child.title;
      if (config.enabled[child.id]) {
        const { links, dropped } = takeLinks(child, seen);
        if (links.length) {
          out.push({ sourceId: child.id, title, synthetic: prefix !== "", links, duplicatesDropped: dropped });
        }
      }
      // 부모가 꺼져 있어도 자손은 독립적으로 켤 수 있다
      walk(child, title);
    }
  };
  walk(spaceFolder, "");

  if (own.links.length) {
    out.push({
      sourceId: spaceFolder.id, title: SHARED_COLLECTION_TITLE, synthetic: true,
      links: own.links, duplicatesDropped: own.dropped,
    });
  }
  return out;
}

function tally(spaces: PlannedSpace[]): ImportPlan["totals"] {
  let collections = 0, links = 0, duplicates = 0;
  for (const s of spaces) {
    for (const c of s.collections) {
      collections += 1;
      links += c.links.length;
      duplicates += c.duplicatesDropped;
    }
  }
  return { spaces: spaces.length, collections, links, duplicates };
}

/**
 * 소스 트리 + 선택 상태 → 만들어질 스페이스·컬렉션·링크 계획.
 * 미리보기와 실제 삽입이 같은 결과를 쓰도록 부수효과를 두지 않는다.
 */
export function planImport(roots: SourceNode[], config: ImportConfig): ImportPlan {
  const seen = new Set<string>();
  const spaces: PlannedSpace[] = [];

  for (const root of roots) {
    // 1단 폴더 = 스페이스 (children 순서를 유지해 중복 선점 순서를 예측 가능하게 둔다)
    for (const child of root.children ?? []) {
      if (!isFolder(child)) continue;
      if (!config.enabled[child.id]) continue;
      const collections = collectCollections(child, seen, config);
      if (collections.length) {
        spaces.push({ sourceId: child.id, name: child.title, collections });
      }
    }
    // 루트 직속 링크 → 루트 이름의 스페이스. 폴더들 뒤에 붙는다.
    const looseId = looseSourceId(root.id);
    if (config.enabled[looseId]) {
      const { links, dropped } = takeLinks(root, seen);
      if (links.length) {
        spaces.push({
          sourceId: looseId, name: root.title,
          collections: [{
            sourceId: looseId, title: SHARED_COLLECTION_TITLE, synthetic: true,
            links, duplicatesDropped: dropped,
          }],
        });
      }
    }
  }

  return { spaces, totals: tally(spaces) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tablign/core test import-plan`
Expected: PASS (15건 전체 통과)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/import/types.ts packages/core/src/import/plan.ts packages/core/src/__tests__/import-plan.test.ts
git commit -m "[기능] 북마크 가져오기 계획 함수 planImport"
```

---

### Task 3: 기본 선택값 `defaultEnabled`

다이얼로그가 열린 순간의 체크 상태. 사용자는 백지에서 지정하지 않고 **고치는 것만** 한다.

**Files:**
- Modify: `packages/core/src/import/plan.ts` (`defaultEnabled` 추가)
- Test: `packages/core/src/__tests__/import-plan.test.ts` (describe 블록 추가)

**Interfaces:**
- Consumes: `countLinks`, `looseSourceId`, `LARGE_FOLDER_THRESHOLD`, `SourceNode` (Task 2).
- Produces: `defaultEnabled(roots: SourceNode[]): Record<string, boolean>` — `planImport`의 `config.enabled`에 바로 넣을 수 있는 값.

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/__tests__/import-plan.test.ts`:

```ts
import { defaultEnabled, LARGE_FOLDER_THRESHOLD } from "../import/plan";

describe("defaultEnabled", () => {
  const many = (n: number, prefix: string): SourceNode[] =>
    Array.from({ length: n }, (_, i) => link(`${prefix}${i}`, `https://${prefix}.com/${i}`));

  it("북마크바(primary) 아래 폴더는 켜짐", () => {
    const roots = tree();
    const e = defaultEnabled(roots);
    expect(e.dev).toBe(true);
    expect(e.react).toBe(true);
    expect(e.hooks).toBe(true);
    expect(e.news).toBe(true);
  });

  it("루트 직속 링크 묶음도 primary면 켜짐", () => {
    const e = defaultEnabled(tree());
    expect(e[looseSourceId("1")]).toBe(true);
  });

  it("primary가 아닌 루트(기타 북마크) 아래는 전부 꺼짐", () => {
    const e = defaultEnabled(tree());
    expect(e.tmp).toBe(false);
    expect(e[looseSourceId("2")]).toBe(false);
  });

  it("자손 포함 링크가 100개를 넘는 1단 폴더는 꺼짐", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "later", title: "나중에 읽기", children: many(LARGE_FOLDER_THRESHOLD + 1, "l") },
      { id: "small", title: "작은폴더", children: many(3, "s") },
    ]}];
    const e = defaultEnabled(roots);
    expect(e.later).toBe(false);
    expect(e.small).toBe(true);
  });

  it("100개 정확히는 켜짐(경계)", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "edge", title: "딱백개", children: many(LARGE_FOLDER_THRESHOLD, "e") },
    ]}];
    expect(defaultEnabled(roots).edge).toBe(true);
  });

  it("큰 1단 폴더의 자손도 함께 꺼진다", () => {
    const roots: SourceNode[] = [{ id: "1", title: "북마크바", primary: true, children: [
      { id: "big", title: "큰폴더", children: [
        { id: "inner", title: "안쪽", children: many(LARGE_FOLDER_THRESHOLD + 1, "b") },
      ]},
    ]}];
    const e = defaultEnabled(roots);
    expect(e.big).toBe(false);
    expect(e.inner).toBe(false);
  });

  it("결과를 planImport에 그대로 넣을 수 있다", () => {
    const roots = tree();
    const plan = planImport(roots, { enabled: defaultEnabled(roots) });
    // 기타 북마크의 '임시'는 기본 해제이므로 스페이스가 되지 않는다
    expect(plan.spaces.map((s) => s.sourceId)).not.toContain("tmp");
    expect(plan.spaces.map((s) => s.sourceId)).toContain("dev");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tablign/core test import-plan`
Expected: FAIL — `defaultEnabled is not a function` (또는 export 없음 오류)

- [ ] **Step 3: Write minimal implementation**

Append to `packages/core/src/import/plan.ts`:

```ts
/**
 * 다이얼로그가 열린 순간의 체크 상태.
 * - 사용자가 매일 보는 루트(primary, Chrome의 북마크바) 아래만 기본으로 켠다.
 *   나머지 루트(기타 북마크·모바일 북마크)는 사실상 창고다.
 * - 자손 포함 링크가 LARGE_FOLDER_THRESHOLD를 넘는 1단 폴더는 끈다.
 *   대개 "나중에 읽기" 같은 묘지라서, 켜면 첫 보드가 못 쓰게 된다.
 */
export function defaultEnabled(roots: SourceNode[]): Record<string, boolean> {
  const enabled: Record<string, boolean> = {};

  for (const root of roots) {
    const primary = root.primary === true;

    for (const child of root.children ?? []) {
      if (!isFolder(child)) continue;
      const on = primary && countLinks(child) <= LARGE_FOLDER_THRESHOLD;
      // 1단 폴더와 그 자손은 같은 기본값을 갖는다(스페이스를 끄면 안쪽도 꺼진 상태로 시작)
      const mark = (n: SourceNode) => {
        enabled[n.id] = on;
        for (const g of n.children ?? []) if (isFolder(g)) mark(g);
      };
      mark(child);
    }
    enabled[looseSourceId(root.id)] = primary;
  }

  return enabled;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tablign/core test import-plan`
Expected: PASS (Task 2의 15건 + 7건)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/import/plan.ts packages/core/src/__tests__/import-plan.test.ts
git commit -m "[기능] 북마크 가져오기 기본 선택값 defaultEnabled"
```

---

### Task 4: Chrome 북마크 트리 정규화 `fromChromeTree`

Chrome 의존을 이 파일 하나에 격리한다. 여기서 `http`/`https`가 아닌 북마크와 빈 폴더를 걸러내므로, 트리에 표시되는 링크 개수부터 이미 진실이다.

**Files:**
- Create: `packages/core/src/import/chrome.ts`
- Test: `packages/core/src/__tests__/import-chrome.test.ts`
- Modify: `packages/core/src/index.ts` (export 추가)

**Interfaces:**
- Consumes: `isImportableUrl` (Task 1), `SourceNode` (Task 2).
- Produces:
  - `CHROME_BOOKMARKS_BAR_ID = "1"`
  - `fromChromeTree(nodes: ChromeBookmarkNode[]): SourceNode[]` — Chrome 루트의 **자식들**(북마크바·기타 북마크·모바일 북마크)을 받아 정규화된 루트 배열을 반환. 링크·자손이 모두 없는 폴더는 제거하고, 북마크바에 `primary: true`를 붙인다.
  - `interface ChromeBookmarkNode { id: string; title: string; url?: string; children?: ChromeBookmarkNode[] }`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/import-chrome.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fromChromeTree, CHROME_BOOKMARKS_BAR_ID, type ChromeBookmarkNode } from "../import/chrome";

describe("fromChromeTree", () => {
  it("북마크바에 primary를 붙이고 나머지 루트에는 붙이지 않는다", () => {
    const roots = fromChromeTree([
      { id: CHROME_BOOKMARKS_BAR_ID, title: "북마크바", children: [{ id: "l", title: "A", url: "https://a.com" }] },
      { id: "2", title: "기타 북마크", children: [{ id: "l2", title: "B", url: "https://b.com" }] },
    ]);
    expect(roots[0].primary).toBe(true);
    expect(roots[1].primary).toBeUndefined();
  });

  it("http·https가 아닌 북마크를 제거한다", () => {
    const roots = fromChromeTree([{
      id: "1", title: "북마크바", children: [
        { id: "f", title: "F", children: [
          { id: "ok", title: "정상", url: "https://a.com" },
          { id: "js", title: "북마클릿", url: "javascript:alert(1)" },
          { id: "ch", title: "설정", url: "chrome://settings" },
        ]},
      ],
    }]);
    const folder = roots[0].children![0];
    expect(folder.children!.map((c) => c.id)).toEqual(["ok"]);
  });

  it("링크와 자손이 모두 없는 폴더를 제거한다", () => {
    const roots = fromChromeTree([{
      id: "1", title: "북마크바", children: [
        { id: "empty", title: "빈폴더", children: [] },
        { id: "onlyEmptyChild", title: "껍데기", children: [{ id: "e2", title: "안쪽빈폴더", children: [] }] },
        { id: "keep", title: "살아있음", children: [{ id: "l", title: "A", url: "https://a.com" }] },
      ],
    }]);
    expect(roots[0].children!.map((c) => c.id)).toEqual(["keep"]);
  });

  it("걸러낸 뒤 링크가 하나도 없는 루트는 제거한다", () => {
    const roots = fromChromeTree([
      { id: "1", title: "북마크바", children: [{ id: "l", title: "A", url: "https://a.com" }] },
      { id: "3", title: "모바일 북마크", children: [{ id: "js", title: "북마클릿", url: "javascript:void(0)" }] },
    ]);
    expect(roots.map((r) => r.id)).toEqual(["1"]);
  });

  it("중첩 구조와 순서를 그대로 유지한다", () => {
    const input: ChromeBookmarkNode[] = [{
      id: "1", title: "북마크바", children: [
        { id: "dev", title: "개발", children: [
          { id: "react", title: "React", children: [{ id: "l1", title: "A", url: "https://react.dev/a" }] },
          { id: "l2", title: "직속", url: "https://dev.local/x" },
        ]},
      ],
    }];
    const roots = fromChromeTree(input);
    const dev = roots[0].children![0];
    expect(dev.children!.map((c) => c.id)).toEqual(["react", "l2"]);
    expect(dev.children![0].children![0].url).toBe("https://react.dev/a");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tablign/core test import-chrome`
Expected: FAIL — `Failed to resolve import "../import/chrome"`

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/import/chrome.ts`:

```ts
import { isImportableUrl } from "./url";
import type { SourceNode } from "./types";

/** Chrome 북마크바의 고정 id. */
export const CHROME_BOOKMARKS_BAR_ID = "1";

/** chrome.bookmarks.BookmarkTreeNode에서 우리가 쓰는 부분만. */
export interface ChromeBookmarkNode {
  id: string;
  title: string;
  url?: string;
  children?: ChromeBookmarkNode[];
}

/** 링크·자손이 하나도 없는 폴더를 걷어내며 SourceNode로 바꾼다. 없으면 null. */
function convert(node: ChromeBookmarkNode): SourceNode | null {
  if (node.url !== undefined) {
    // 탭으로 열 수 없는 주소는 애초에 세지 않는다 — 나중에 조용히 사라지면 안 된다
    return isImportableUrl(node.url) ? { id: node.id, title: node.title, url: node.url } : null;
  }
  const children = (node.children ?? [])
    .map(convert)
    .filter((n): n is SourceNode => n !== null);
  if (!children.length) return null;
  return { id: node.id, title: node.title, children };
}

/**
 * Chrome 루트의 자식들(북마크바·기타 북마크·모바일 북마크)을 정규화한다.
 * chrome.bookmarks.getTree()[0].children를 그대로 넘기면 된다.
 */
export function fromChromeTree(nodes: ChromeBookmarkNode[]): SourceNode[] {
  const roots: SourceNode[] = [];
  for (const node of nodes) {
    const converted = convert(node);
    if (!converted) continue;
    roots.push(
      node.id === CHROME_BOOKMARKS_BAR_ID ? { ...converted, primary: true } : converted,
    );
  }
  return roots;
}
```

Modify `packages/core/src/index.ts` — 기존 export 목록 끝에 추가:

```ts
export * from "./import/types";
export * from "./import/url";
export * from "./import/plan";
export * from "./import/chrome";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tablign/core test import-chrome && pnpm --filter @tablign/core lint`
Expected: 테스트 PASS, `tsc --noEmit` 오류 없음

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/import/chrome.ts packages/core/src/__tests__/import-chrome.test.ts packages/core/src/index.ts
git commit -m "[기능] Chrome 북마크 트리 정규화"
```

---

### Task 5: `import_bookmarks` RPC와 데이터 래퍼

스페이스·컬렉션·링크를 한 트랜잭션에 넣는다. 중간 실패 시 반쪽짜리 보드가 남지 않아야 한다.

**Files:**
- Create: `supabase/migrations/0024_import_bookmarks.sql`, `packages/core/src/data/import.ts`
- Test: `packages/core/src/__tests__/import-bookmarks.test.ts`
- Modify: `packages/core/src/index.ts` (export 추가)

**Interfaces:**
- Consumes: `ImportPlan` (Task 2), 기존 `can_edit_org(uuid)` SQL 헬퍼(`supabase/migrations/0014_organizations.sql`).
- Produces:
  - SQL `public.import_bookmarks(p_org_id uuid, p_payload jsonb) returns jsonb`
  - `interface ImportResult { space_ids: string[]; first_space_id: string; links: number }`
  - `importBookmarks(client: SupabaseClient, orgId: string, plan: ImportPlan): Promise<ImportResult>`

**권한 근거:** `can_edit_org`는 `owner_id = auth.uid()` 또는 `organization_members.role = 'admin'`이다. `spaces_insert` 정책도 `can_edit_org(org_id)`를 요구하므로, **팀 조직의 일반 멤버는 스페이스를 만들 수 없다** — 가져오기도 같은 선에서 막히는 것이 맞다.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/__tests__/import-bookmarks.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ws from "ws";
import { importBookmarks } from "../data/import";
import type { ImportPlan } from "../import/types";

const envText = readFileSync(resolve(__dirname, "../../.env.test"), "utf8");
const env = Object.fromEntries(
  envText.split("\n").filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);
const URL_ = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) throw new Error(".env.test 키 누락");

async function makeUser(email: string): Promise<{ client: SupabaseClient; id: string }> {
  const admin = createClient(URL_, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: "test-password-1234", email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(URL_, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email, password: "test-password-1234",
  });
  if (signInError) throw signInError;
  return { client, id: created.user!.id };
}

async function personalOrgId(user: { client: SupabaseClient }): Promise<string> {
  const { data } = await user.client.from("organizations").select("id").eq("is_personal", true).single();
  return (data as { id: string }).id;
}

function plan(spaces: ImportPlan["spaces"]): ImportPlan {
  let collections = 0, links = 0;
  for (const s of spaces) for (const c of s.collections) { collections++; links += c.links.length; }
  return { spaces, totals: { spaces: spaces.length, collections, links, duplicates: 0 } };
}

const col = (title: string, urls: string[]) => ({
  sourceId: title, title, synthetic: false, duplicatesDropped: 0,
  links: urls.map((u) => ({ url: u, title: u, favicon_url: `${new URL(u).origin}/favicon.ico` })),
});

let alice: { client: SupabaseClient; id: string };
let bob: { client: SupabaseClient; id: string };
let aliceOrg: string;

beforeAll(async () => {
  alice = await makeUser(`imp-alice-${Date.now()}@test.local`);
  bob = await makeUser(`imp-bob-${Date.now()}@test.local`);
  aliceOrg = await personalOrgId(alice);
}, 60000);

describe("import_bookmarks RPC", () => {
  it("스페이스·컬렉션·링크를 만들고 요약을 반환한다", async () => {
    const result = await importBookmarks(alice.client, aliceOrg, plan([
      { sourceId: "dev", name: "개발", collections: [
        col("React", ["https://react.dev/a", "https://react.dev/b"]),
        col("공유 폴더", ["https://dev.local/x"]),
      ]},
      { sourceId: "news", name: "뉴스", collections: [col("공유 폴더", ["https://news.local/a"])] },
    ]));

    expect(result.space_ids).toHaveLength(2);
    expect(result.first_space_id).toBe(result.space_ids[0]);
    expect(result.links).toBe(4);

    const { data: spaces } = await alice.client
      .from("spaces").select("id,name,position").in("id", result.space_ids).order("position");
    expect((spaces as { name: string }[]).map((s) => s.name)).toEqual(["개발", "뉴스"]);

    const { data: cols } = await alice.client
      .from("collections").select("title,position,is_private").eq("space_id", result.space_ids[0]).order("position");
    expect((cols as { title: string }[]).map((c) => c.title)).toEqual(["React", "공유 폴더"]);
    expect((cols as { is_private: boolean }[])[0].is_private).toBe(false);
  }, 60000);

  it("링크의 url·title·favicon_url·position을 보존한다", async () => {
    const result = await importBookmarks(alice.client, aliceOrg, plan([
      { sourceId: "s", name: "보존확인", collections: [col("C", ["https://a.com/1", "https://a.com/2"])] },
    ]));
    const { data: cols } = await alice.client
      .from("collections").select("id").eq("space_id", result.space_ids[0]);
    const { data: links } = await alice.client
      .from("links").select("url,title,favicon_url,position")
      .eq("collection_id", (cols as { id: string }[])[0].id).order("position");
    const rows = links as { url: string; favicon_url: string; position: number }[];
    expect(rows.map((l) => l.url)).toEqual(["https://a.com/1", "https://a.com/2"]);
    expect(rows[0].favicon_url).toBe("https://a.com/favicon.ico");
    expect(rows.map((l) => l.position)).toEqual([1000, 2000]);
  }, 60000);

  it("스페이스 position은 조직 기존 최대값 뒤에 이어 붙는다", async () => {
    const { data: before } = await alice.client
      .from("spaces").select("position").eq("org_id", aliceOrg).order("position", { ascending: false }).limit(1);
    const maxBefore = (before as { position: number }[])[0]?.position ?? 0;

    const result = await importBookmarks(alice.client, aliceOrg, plan([
      { sourceId: "s", name: "뒤에붙음", collections: [col("C", ["https://tail.com/1"])] },
    ]));
    const { data } = await alice.client.from("spaces").select("position").eq("id", result.space_ids[0]).single();
    expect((data as { position: number }).position).toBeGreaterThan(maxBefore);
  }, 60000);

  it("남의 조직에는 가져올 수 없다", async () => {
    await expect(
      importBookmarks(bob.client, aliceOrg, plan([
        { sourceId: "s", name: "침입", collections: [col("C", ["https://evil.com/1"])] },
      ])),
    ).rejects.toThrow();

    const { data } = await alice.client.from("spaces").select("id").eq("org_id", aliceOrg).eq("name", "침입");
    expect(data).toHaveLength(0);
  }, 60000);

  it("빈 계획은 거부한다", async () => {
    await expect(importBookmarks(alice.client, aliceOrg, plan([]))).rejects.toThrow();
  }, 60000);

  it("컬렉션이 여러 개면 position이 순서대로 부여된다", async () => {
    const result = await importBookmarks(alice.client, aliceOrg, plan([
      { sourceId: "s", name: "순서확인", collections: [
        col("A", ["https://o.com/1"]), col("B", ["https://o.com/2"]), col("C", ["https://o.com/3"]),
      ]},
    ]));
    const { data } = await alice.client
      .from("collections").select("title,position").eq("space_id", result.space_ids[0]).order("position");
    expect(data).toEqual([
      { title: "A", position: 1000 }, { title: "B", position: 2000 }, { title: "C", position: 3000 },
    ]);
  }, 60000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tablign/core test import-bookmarks`
Expected: FAIL — `Failed to resolve import "../data/import"`

- [ ] **Step 3: Write the migration and the wrapper**

Create `supabase/migrations/0024_import_bookmarks.sql`:

```sql
-- 북마크 가져오기: 스페이스·컬렉션·링크를 한 트랜잭션에 삽입한다.
-- 클라이언트에서 반복 insert하면 중간 실패 시 반쪽짜리 보드가 남는다.
-- security definer + can_edit_org 검증 (copy_collection과 같은 방식).
create function public.import_bookmarks(p_org_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_base_pos double precision;
  v_space_ids uuid[] := '{}';
  v_space_id uuid;
  v_col_id uuid;
  v_links int := 0;
  v_space record;
  v_col record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- owner 또는 admin만. 팀 조직의 일반 멤버는 spaces_insert 정책과 동일하게 막힌다.
  if not public.can_edit_org(p_org_id) then
    raise exception 'org not found or not editable';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'array' or jsonb_array_length(p_payload) = 0 then
    raise exception 'nothing to import';
  end if;

  -- 새 스페이스는 이 조직 기존 스페이스 뒤에 붙는다 (GAP=1000 규칙)
  select coalesce(max(position), 0) into v_base_pos from spaces where org_id = p_org_id;

  for v_space in
    select value, ordinality from jsonb_array_elements(p_payload) with ordinality as t(value, ordinality)
  loop
    insert into spaces (user_id, org_id, name, position)
    values (v_uid, p_org_id, v_space.value->>'name', v_base_pos + v_space.ordinality * 1000)
    returning id into v_space_id;
    v_space_ids := v_space_ids || v_space_id;

    for v_col in
      select value, ordinality
      from jsonb_array_elements(coalesce(v_space.value->'collections', '[]'::jsonb))
        with ordinality as t(value, ordinality)
    loop
      insert into collections (space_id, user_id, title, position)
      values (v_space_id, v_uid, v_col.value->>'title', v_col.ordinality * 1000)
      returning id into v_col_id;

      insert into links (collection_id, user_id, url, title, favicon_url, position)
      select v_col_id, v_uid, l.value->>'url', l.value->>'title', l.value->>'favicon_url',
             l.ordinality * 1000
      from jsonb_array_elements(coalesce(v_col.value->'links', '[]'::jsonb))
        with ordinality as l(value, ordinality);

      v_links := v_links + coalesce(jsonb_array_length(v_col.value->'links'), 0);
    end loop;
  end loop;

  return jsonb_build_object(
    'space_ids', to_jsonb(v_space_ids),
    'first_space_id', v_space_ids[1],
    'links', v_links
  );
end;
$$;

revoke execute on function public.import_bookmarks(uuid, jsonb) from public, anon;
grant execute on function public.import_bookmarks(uuid, jsonb) to authenticated;
```

Create `packages/core/src/data/import.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportPlan } from "../import/types";

export interface ImportResult {
  space_ids: string[];
  first_space_id: string;
  links: number;
}

/**
 * 계획을 RPC 페이로드로 줄여 보낸다.
 * sourceId·synthetic·duplicatesDropped는 UI 표시용이므로 서버로 보내지 않는다.
 */
function toPayload(plan: ImportPlan) {
  return plan.spaces.map((s) => ({
    name: s.name,
    collections: s.collections.map((c) => ({
      title: c.title,
      links: c.links.map((l) => ({ url: l.url, title: l.title, favicon_url: l.favicon_url })),
    })),
  }));
}

/** 계획을 대상 조직에 단일 트랜잭션으로 삽입하고 요약을 반환한다. */
export async function importBookmarks(
  client: SupabaseClient,
  orgId: string,
  plan: ImportPlan,
): Promise<ImportResult> {
  const { data, error } = await client.rpc("import_bookmarks", {
    p_org_id: orgId,
    p_payload: toPayload(plan),
  });
  if (error) throw error;
  return data as ImportResult;
}
```

Modify `packages/core/src/index.ts` — export 목록에 추가:

```ts
export * from "./data/import";
```

- [ ] **Step 4: Push the migration and run the test**

Run:
```bash
supabase db push
pnpm --filter @tablign/core test import-bookmarks
```
Expected: 마이그레이션 적용 후 테스트 6건 PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0024_import_bookmarks.sql packages/core/src/data/import.ts packages/core/src/__tests__/import-bookmarks.test.ts packages/core/src/index.ts
git commit -m "[기능] 북마크 가져오기 RPC import_bookmarks"
```

---

### Task 6: `ImportBookmarksDialog` 컴포넌트

2단 미리보기 다이얼로그. `SourceNode[]`를 받아 내부에서 `planImport`를 돌리고 그린다. 데이터 접근·권한·Chrome API를 모른다.

**Files:**
- Create: `packages/ui/src/ImportBookmarksDialog.tsx`
- Test: `packages/ui/src/__tests__/ImportBookmarksDialog.test.tsx`
- Modify: `packages/ui/src/index.ts` (export 추가)

**Interfaces:**
- Consumes: `planImport`·`defaultEnabled`·`countLinks`·`looseSourceId`·`SHARED_COLLECTION_TITLE`·`MAX_IMPORT_LINKS`·`LARGE_FOLDER_THRESHOLD`·타입 from `@tablign/core` (Task 2·3). `theme`·`Button`·`overlayAnimation` from 같은 패키지.
- Produces:
  - `interface ImportOrgOption { id: string; name: string }`
  - `interface ImportBookmarksDialogProps { open: boolean; roots: SourceNode[]; orgs: ImportOrgOption[]; defaultOrgId: string; onImport: (orgId: string, plan: ImportPlan) => Promise<void>; onClose: () => void }`
  - `ImportBookmarksDialog(props): JSX.Element | null`

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/__tests__/ImportBookmarksDialog.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { SourceNode } from "@tablign/core";
import { ImportBookmarksDialog } from "../ImportBookmarksDialog";

const link = (id: string, url: string, title = id): SourceNode => ({ id, title, url });

const roots: SourceNode[] = [
  { id: "1", title: "북마크바", primary: true, children: [
    { id: "dev", title: "개발", children: [
      { id: "react", title: "React", children: [link("r1", "https://react.dev/a")] },
      link("d1", "https://dev.local/x"),
    ]},
    { id: "news", title: "뉴스", children: [link("w1", "https://news.local/a")] },
  ]},
];

const orgs = [{ id: "o1", name: "개인" }, { id: "o2", name: "허레이" }];
function noop() {}

function open(overrides: Partial<React.ComponentProps<typeof ImportBookmarksDialog>> = {}) {
  const onImport = vi.fn().mockResolvedValue(undefined);
  render(
    <ImportBookmarksDialog
      open roots={roots} orgs={orgs} defaultOrgId="o1"
      onImport={onImport} onClose={noop} {...overrides}
    />,
  );
  return { onImport };
}

describe("ImportBookmarksDialog", () => {
  it("1단 폴더를 스페이스로, 안쪽 폴더와 공유 폴더를 컬렉션으로 미리 보여준다", () => {
    open();
    // 왼쪽 트리
    expect(screen.getByText("개발")).toBeInTheDocument();
    expect(screen.getByText("뉴스")).toBeInTheDocument();
    // 오른쪽 미리보기 — 개발 보드에 React와 공유 폴더
    expect(screen.getByTestId("preview-space-dev")).toBeInTheDocument();
    expect(screen.getByTestId("preview-col-react")).toHaveTextContent("React");
    expect(screen.getByTestId("preview-col-dev")).toHaveTextContent("공유 폴더");
  });

  it("푸터에 링크 수와 스페이스 수를 요약한다", () => {
    open();
    expect(screen.getByTestId("import-summary")).toHaveTextContent("링크 3개");
    expect(screen.getByTestId("import-summary")).toHaveTextContent("스페이스 2개");
  });

  it("폴더를 끄면 미리보기와 요약이 함께 줄어든다", () => {
    open();
    fireEvent.click(screen.getByTestId("tree-row-news"));
    expect(screen.queryByTestId("preview-space-news")).not.toBeInTheDocument();
    expect(screen.getByTestId("import-summary")).toHaveTextContent("링크 2개");
    expect(screen.getByTestId("import-summary")).toHaveTextContent("스페이스 1개");
  });

  it("스페이스를 끄면 그 안 컬렉션도 함께 꺼진다", () => {
    open();
    fireEvent.click(screen.getByTestId("tree-row-dev"));
    expect(screen.queryByTestId("preview-space-dev")).not.toBeInTheDocument();
    // 다시 켜면 컬렉션도 돌아온다
    fireEvent.click(screen.getByTestId("tree-row-dev"));
    expect(screen.getByTestId("preview-col-react")).toBeInTheDocument();
  });

  it("중복으로 빠진 개수를 컬렉션에 표시한다", () => {
    const dupRoots: SourceNode[] = [
      { id: "1", title: "북마크바", primary: true, children: [
        { id: "a", title: "A", children: [link("l1", "https://same.com/x")] },
        { id: "b", title: "B", children: [link("l2", "https://same.com/x"), link("l3", "https://b.com/1")] },
      ]},
    ];
    render(
      <ImportBookmarksDialog open roots={dupRoots} orgs={orgs} defaultOrgId="o1"
        onImport={vi.fn()} onClose={noop} />,
    );
    expect(screen.getByTestId("preview-col-b")).toHaveTextContent("−1");
    expect(screen.getByTestId("import-summary")).toHaveTextContent("중복 URL 1개");
  });

  it("모든 폴더를 끄면 가져오기가 막힌다", () => {
    open();
    fireEvent.click(screen.getByTestId("tree-row-dev"));
    fireEvent.click(screen.getByTestId("tree-row-news"));
    expect(screen.getByRole("button", { name: "가져오기" })).toBeDisabled();
  });

  it("조직이 여럿이면 선택기를 보여주고 기본값이 선택돼 있다", () => {
    open();
    const select = screen.getByLabelText("가져올 조직") as HTMLSelectElement;
    expect(select.value).toBe("o1");
  });

  it("조직이 하나면 선택기 대신 읽기 전용으로 목적지를 보여준다", () => {
    open({ orgs: [{ id: "o1", name: "개인" }] });
    expect(screen.queryByLabelText("가져올 조직")).not.toBeInTheDocument();
    expect(screen.getByTestId("import-org-fixed")).toHaveTextContent("개인");
  });

  it("고른 조직과 계획으로 onImport를 호출한다", async () => {
    const { onImport } = open();
    fireEvent.change(screen.getByLabelText("가져올 조직"), { target: { value: "o2" } });
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    const [orgId, plan] = onImport.mock.calls[0];
    expect(orgId).toBe("o2");
    expect(plan.totals).toEqual({ spaces: 2, collections: 3, links: 3, duplicates: 0 });
  });

  it("가져오는 중에는 버튼이 비활성이고 문구가 바뀐다", async () => {
    let resolveImport: () => void = () => {};
    const onImport = vi.fn(() => new Promise<void>((r) => { resolveImport = r; }));
    render(
      <ImportBookmarksDialog open roots={roots} orgs={orgs} defaultOrgId="o1"
        onImport={onImport} onClose={noop} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    expect(await screen.findByRole("button", { name: "가져오는 중…" })).toBeDisabled();
    resolveImport();
  });

  it("실패하면 다이얼로그를 유지하고 오류를 보여준다", async () => {
    const onImport = vi.fn().mockRejectedValue(new Error("boom"));
    const onClose = vi.fn();
    render(
      <ImportBookmarksDialog open roots={roots} orgs={orgs} defaultOrgId="o1"
        onImport={onImport} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));
    expect(await screen.findByText(/가져오지 못했어요/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "가져오기" })).not.toBeDisabled();
  });

  it("링크 100개를 넘는 폴더는 기본 해제하고 이유를 적는다", () => {
    const bigRoots: SourceNode[] = [
      { id: "1", title: "북마크바", primary: true, children: [
        { id: "later", title: "나중에 읽기",
          children: Array.from({ length: 101 }, (_, i) => link(`x${i}`, `https://x.com/${i}`)) },
        { id: "keep", title: "작은폴더", children: [link("k1", "https://k.com/1")] },
      ]},
    ];
    render(
      <ImportBookmarksDialog open roots={bigRoots} orgs={orgs} defaultOrgId="o1"
        onImport={vi.fn()} onClose={noop} />,
    );
    expect(screen.queryByTestId("preview-space-later")).not.toBeInTheDocument();
    expect(screen.getByTestId("preview-space-keep")).toBeInTheDocument();
    expect(screen.getByTestId("large-folder-note")).toBeInTheDocument();
  });

  it("링크가 상한을 넘으면 가져오기를 막고 이유를 보여준다", () => {
    const hugeRoots: SourceNode[] = [
      { id: "1", title: "북마크바", primary: true, children: [
        { id: "huge", title: "거대폴더", children: Array.from({ length: 2001 },
          (_, i) => link(`h${i}`, `https://h.com/${i}`)) },
      ]},
    ];
    render(
      <ImportBookmarksDialog open roots={hugeRoots} orgs={orgs} defaultOrgId="o1"
        onImport={vi.fn()} onClose={noop} />,
    );
    // 거대폴더는 100개 초과라 기본 해제 상태 → 먼저 켠 다음 상한을 확인한다
    fireEvent.click(screen.getByTestId("tree-row-huge"));
    expect(screen.getByRole("button", { name: "가져오기" })).toBeDisabled();
    expect(screen.getByTestId("over-limit-note")).toBeInTheDocument();
  });

  it("open이 false면 아무것도 그리지 않는다", () => {
    const { container } = render(
      <ImportBookmarksDialog open={false} roots={roots} orgs={orgs} defaultOrgId="o1"
        onImport={vi.fn()} onClose={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tablign/ui test ImportBookmarksDialog`
Expected: FAIL — `Failed to resolve import "../ImportBookmarksDialog"`

- [ ] **Step 3: Write minimal implementation**

Create `packages/ui/src/ImportBookmarksDialog.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import {
  planImport, defaultEnabled, countLinks, looseSourceId,
  SHARED_COLLECTION_TITLE, MAX_IMPORT_LINKS, LARGE_FOLDER_THRESHOLD,
  type ImportPlan, type SourceNode,
} from "@tablign/core";
import { theme } from "./theme";
import { Button } from "./Button";
import { overlayAnimationCss, overlayIn, panelIn } from "./overlayAnimation";

export interface ImportOrgOption { id: string; name: string }

export interface ImportBookmarksDialogProps {
  open: boolean;
  /** 정규화된 소스 트리(fromChromeTree 결과) */
  roots: SourceNode[];
  /** 가져올 수 있는 조직만 */
  orgs: ImportOrgOption[];
  defaultOrgId: string;
  onImport: (orgId: string, plan: ImportPlan) => Promise<void>;
  onClose: () => void;
}

/** 트리에 그릴 한 줄. 폴더와 루트 직속 링크 묶음만 줄이 된다(링크는 개수로만 나온다). */
interface Row {
  id: string;
  label: string;
  depth: number;
  /** 1단 폴더(=스페이스가 될 것)인지 */
  isSpace: boolean;
  /** 직속 링크 수 */
  count: number;
  /** 깊이 3 이상에서 합쳐질 이름 힌트 */
  joined?: string;
  /** 스페이스 행이면 함께 끌 자손 폴더 id들 */
  descendants: string[];
  /** 루트 이름(직속 링크 묶음 행에만) */
  rootName?: string;
}

const isFolder = (n: SourceNode) => n.url === undefined;
const directLinkCount = (n: SourceNode) => (n.children ?? []).filter((c) => !isFolder(c)).length;

function buildRows(roots: SourceNode[]): { groups: { name: string; rows: Row[] }[] } {
  const groups: { name: string; rows: Row[] }[] = [];
  for (const root of roots) {
    const rows: Row[] = [];
    for (const child of root.children ?? []) {
      if (!isFolder(child)) continue;
      const descendants: string[] = [];
      const collect = (n: SourceNode) => {
        for (const g of n.children ?? []) if (isFolder(g)) { descendants.push(g.id); collect(g); }
      };
      collect(child);
      rows.push({
        id: child.id, label: child.title, depth: 1, isSpace: true,
        count: directLinkCount(child), descendants,
      });
      const walk = (n: SourceNode, depth: number, prefix: string) => {
        for (const g of n.children ?? []) {
          if (!isFolder(g)) continue;
          const joined = prefix ? `${prefix}/${g.title}` : g.title;
          rows.push({
            id: g.id, label: g.title, depth, isSpace: false,
            count: directLinkCount(g), descendants: [],
            joined: depth >= 3 ? joined : undefined,
          });
          walk(g, depth + 1, joined);
        }
      };
      walk(child, 2, "");
    }
    const looseCount = directLinkCount(root);
    if (looseCount) {
      rows.push({
        id: looseSourceId(root.id), label: "폴더에 없는 링크", depth: 1, isSpace: true,
        count: looseCount, descendants: [], rootName: root.title,
      });
    }
    if (rows.length) groups.push({ name: root.title, rows });
  }
  return { groups };
}

/** 가져오기 다이얼로그. 왼쪽에서 고르면 오른쪽에 만들어질 결과가 즉시 바뀐다. */
export function ImportBookmarksDialog({
  open, roots, orgs, defaultOrgId, onImport, onClose,
}: ImportBookmarksDialogProps) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [orgId, setOrgId] = useState(defaultOrgId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 열릴 때마다 기본 선택값으로 되돌린다
  useEffect(() => {
    if (!open) return;
    setEnabled(defaultEnabled(roots));
    setOrgId(defaultOrgId);
    setBusy(false);
    setError(null);
  }, [open, roots, defaultOrgId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !busy) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const { groups } = useMemo(() => buildRows(roots), [roots]);
  const plan = useMemo(() => planImport(roots, { enabled }), [roots, enabled]);

  // 100개 초과로 기본 해제된 폴더가 있으면 이유를 적는다
  const hasLargeFolder = useMemo(
    () => roots.some((r) => (r.children ?? []).some(
      (c) => isFolder(c) && countLinks(c) > LARGE_FOLDER_THRESHOLD,
    )),
    [roots],
  );

  if (!open) return null;

  const overLimit = plan.totals.links > MAX_IMPORT_LINKS;
  const canImport = plan.totals.spaces > 0 && !overLimit && !busy;

  function toggle(row: Row) {
    setEnabled((prev) => {
      const next = { ...prev, [row.id]: !prev[row.id] };
      // 스페이스를 끄면 자손도 함께 꺼진다
      for (const d of row.descendants) next[d] = next[row.id];
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onImport(orgId, plan);
    } catch {
      setError("가져오지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontVariantNumeric: "tabular-nums" as const };

  return (
    <div role="presentation" onClick={() => !busy && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,25,.38)", animation: overlayIn,
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <style>{overlayAnimationCss}</style>
      <div role="dialog" aria-modal="true" aria-label="북마크 가져오기" onClick={(e) => e.stopPropagation()}
        style={{ boxSizing: "border-box", width: 730, maxWidth: "calc(100vw - 32px)", animation: panelIn,
          background: theme.surface, borderRadius: 14, boxShadow: "0 18px 50px rgba(0,0,0,.26)", overflow: "hidden" }}>

        <div style={{ padding: "17px 18px 0" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>북마크 가져오기</div>
          <div style={{ marginTop: 4, fontSize: 12.5, color: theme.textMuted }}>
            왼쪽에서 고르면 오른쪽에 만들어질 결과가 보여요.
          </div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
            {orgs.length > 1 ? (
              <>
                <label htmlFor="import-org" style={{ fontSize: 12, color: theme.textFaint }}>가져올 조직</label>
                <select id="import-org" aria-label="가져올 조직" value={orgId} disabled={busy}
                  onChange={(e) => setOrgId(e.target.value)}
                  style={{ padding: "5px 8px", border: `1px solid ${theme.border}`, borderRadius: 8,
                    fontSize: 12.5, fontFamily: "inherit", background: theme.surface, color: theme.text }}>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </>
            ) : (
              <div data-testid="import-org-fixed" style={{ fontSize: 12, color: theme.textFaint }}>
                가져올 조직 · <strong style={{ color: theme.text }}>{orgs[0]?.name ?? ""}</strong>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", borderTop: `1px solid ${theme.border}`, marginTop: 14 }}>
          {/* 왼쪽 — 내 북마크 */}
          <div style={{ width: 336, flex: "none", borderRight: `1px solid ${theme.border}` }}>
            <div style={{ padding: "9px 13px 7px", fontSize: 10.5, fontWeight: 800,
              letterSpacing: ".07em", color: theme.textFaint }}>내 북마크</div>
            <div style={{ height: 344, overflowY: "auto", padding: "2px 8px 10px" }}>
              {groups.map((g) => (
                <div key={g.name}>
                  <div style={{ padding: "9px 9px 4px", fontSize: 10.5, fontWeight: 800,
                    letterSpacing: ".07em", color: theme.textFaint }}>{g.name}</div>
                  {g.rows.map((row) => {
                    const on = !!enabled[row.id];
                    return (
                      <div key={row.id} data-testid={`tree-row-${row.id}`} role="button" tabIndex={0}
                        onClick={() => toggle(row)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(row); } }}
                        style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 31,
                          padding: "5px 8px", borderRadius: 8, cursor: "pointer", fontSize: 13,
                          marginLeft: (row.depth - 1) * 19 }}>
                        <span aria-hidden style={{ width: 15, height: 15, flex: "none", borderRadius: 4.5,
                          border: `1.5px solid ${on ? theme.accent : "#ccd2da"}`,
                          background: on ? theme.accent : theme.surface }} />
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap", fontWeight: 500,
                          color: on ? theme.text : theme.textFaint }}>{row.label}</span>
                        {row.count > 0 && (
                          <span style={{ ...mono, fontSize: 11, color: theme.textFaint }}>{row.count}</span>
                        )}
                        {row.joined && (
                          <span style={{ marginLeft: "auto", fontSize: 11, color: theme.textFaint }}>{row.joined}</span>
                        )}
                        {row.isSpace && !row.joined && (
                          <span style={{ marginLeft: "auto", flex: "none", padding: "0 7px", height: 22,
                            display: "inline-flex", alignItems: "center", borderRadius: 7, fontSize: 10.5,
                            fontWeight: 700,
                            border: `1px solid ${on ? theme.borderCard : theme.border}`,
                            background: on ? theme.accentWeak : theme.surface2,
                            color: on ? theme.accent : theme.textFaint }}>
                            {row.rootName ?? "스페이스"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {hasLargeFolder && (
                <div data-testid="large-folder-note"
                  style={{ margin: "8px 4px 0", padding: "8px 10px", background: "#fff8ea",
                    border: "1px solid #f2e0b8", borderRadius: 9, fontSize: 11.5,
                    color: "#7a5a15", lineHeight: 1.5 }}>
                  링크 {LARGE_FOLDER_THRESHOLD}개가 넘는 폴더는 기본으로 빼뒀어요. 필요하면 켜세요.
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽 — 만들어질 결과 */}
          <div style={{ flex: 1, minWidth: 0, background: theme.bg }}>
            <div style={{ display: "flex", padding: "9px 13px 7px", fontSize: 10.5, fontWeight: 800,
              letterSpacing: ".07em", color: theme.textFaint }}>
              <span>이렇게 만들어져요</span>
              <span style={{ ...mono, marginLeft: "auto", letterSpacing: 0, fontWeight: 700 }}>
                스페이스 {plan.totals.spaces} · 컬렉션 {plan.totals.collections}
              </span>
            </div>
            <div style={{ height: 344, overflowY: "auto", padding: "8px 12px 12px" }}>
              {plan.spaces.length === 0 && (
                <div style={{ padding: "26px 10px", textAlign: "center", fontSize: 11.5,
                  color: theme.textFaint, lineHeight: 1.6 }}>
                  가져올 폴더를 왼쪽에서 골라주세요.
                </div>
              )}
              {plan.spaces.map((sp) => (
                <div key={sp.sourceId} data-testid={`preview-space-${sp.sourceId}`}
                  style={{ background: theme.surface, border: `1px solid ${theme.borderCard}`,
                    borderRadius: 10, padding: "9px 10px", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: theme.text }}>{sp.name}</span>
                    <span style={{ ...mono, marginLeft: "auto", fontSize: 11, color: theme.textFaint }}>
                      컬렉션 {sp.collections.length}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {sp.collections.map((c) => (
                      <div key={c.sourceId + c.title} data-testid={`preview-col-${c.sourceId}`}
                        style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px",
                          background: theme.bg, borderRadius: 8,
                          border: `1px ${c.synthetic ? "dashed" : "solid"} ${c.synthetic ? theme.borderCard : theme.borderCard}` }}>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: theme.text,
                          minWidth: 0, overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap" }}>{c.title}</span>
                        {c.duplicatesDropped > 0 && (
                          <span style={{ ...mono, marginLeft: "auto", flex: "none", fontSize: 10,
                            fontWeight: 700, color: "#a13030", background: "#fdeeee",
                            border: "1px solid #f5d0d0", borderRadius: 5, padding: "1px 5px" }}>
                            −{c.duplicatesDropped}
                          </span>
                        )}
                        <span style={{ ...mono, marginLeft: c.duplicatesDropped ? 6 : "auto",
                          flex: "none", fontSize: 11, color: theme.textFaint }}>{c.links.length}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px 14px",
          borderTop: `1px solid ${theme.border}` }}>
          <span data-testid="import-summary" style={{ marginRight: "auto", fontSize: 12,
            color: theme.textMuted, lineHeight: 1.5 }}>
            {plan.totals.spaces === 0 ? "가져올 폴더가 없어요" : (
              <>
                링크 <strong style={{ ...mono, color: theme.text }}>{plan.totals.links}</strong>개를
                {" "}스페이스 <strong style={{ ...mono, color: theme.text }}>{plan.totals.spaces}</strong>개로 가져와요
                {plan.totals.duplicates > 0 && (
                  <span style={{ display: "block", fontSize: 11, color: theme.textFaint, marginTop: 1 }}>
                    중복 URL {plan.totals.duplicates}개는 한 번만 담아요
                  </span>
                )}
              </>
            )}
            {overLimit && (
              <span data-testid="over-limit-note"
                style={{ display: "block", fontSize: 11, color: theme.danger, marginTop: 1 }}>
                한 번에 {MAX_IMPORT_LINKS}개까지 가져올 수 있어요. 폴더를 줄여주세요.
              </span>
            )}
            {error && (
              <span style={{ display: "block", fontSize: 11.5, color: theme.danger, marginTop: 2 }}>{error}</span>
            )}
          </span>
          <Button variant="outline" onClick={onClose} disabled={busy}>취소</Button>
          <Button onClick={submit} disabled={!canImport}>{busy ? "가져오는 중…" : "가져오기"}</Button>
        </div>
      </div>
    </div>
  );
}
```

Modify `packages/ui/src/index.ts` — `ImportCodeDialog` export 아래에 추가:

```ts
export * from "./ImportBookmarksDialog";
```

> 주의: 미리보기 컬렉션 제목(`공유 폴더` 포함)은 `planImport`가 이미 채워서 주므로 이 컴포넌트는 문자열을 직접 만들지 않는다. `SHARED_COLLECTION_TITLE` import는 실제로 쓰지 않으면 지운다(`tsc --noEmit`가 잡는다).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tablign/ui test ImportBookmarksDialog && pnpm --filter @tablign/ui lint`
Expected: 테스트 14건 PASS, `tsc --noEmit` 오류 없음

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/ImportBookmarksDialog.tsx packages/ui/src/__tests__/ImportBookmarksDialog.test.tsx packages/ui/src/index.ts
git commit -m "[기능] 북마크 가져오기 다이얼로그"
```

---

### Task 7: 익스텐션 배선 — 권한·트리 로드·조직 메뉴 진입

manifest에 권한을 추가하고, 다이얼로그를 실제 데이터에 연결한다. 조직 헤더 메뉴 진입점까지 이 태스크에 넣는다 — 들어갈 문이 없으면 배선을 검증할 수 없고, 임시 버튼을 커밋하면 죽은 코드가 남는다.

**Files:**
- Modify: `apps/extension/public/manifest.json`, `apps/extension/src/test-setup.ts`, `apps/extension/src/newtab/OrgHeader.tsx`, `apps/extension/src/newtab/NewTab.tsx`
- Test: `apps/extension/src/newtab/NewTab.test.tsx`

**Interfaces:**
- Consumes: `fromChromeTree` (Task 4), `importBookmarks` (Task 5), `ImportBookmarksDialog` (Task 6). 조직 역할은 **이미 있는** `orgMemberships` 상태(`NewTab.tsx:115`, `listMyOrgMemberships`로 171·303행에서 로드)를 그대로 쓴다 — 새 조회를 추가하지 않는다.
- Produces:
  - `OrgHeaderProps` += `onImport?: () => void` — 있으면 메뉴 첫 항목 `가져오기`를 노출.
  - `NewTab` 내부: `bookmarkImportOpen` / `bookmarkRoots` / `importableOrgs` / `openBookmarkImport()` / `runBookmarkImport(orgId, plan)`. Task 8의 온보딩 진입점이 `openBookmarkImport`를 재사용한다.

**권한 근거:** `OrgHeader`의 메뉴는 `showGear`(개인 조직이면 `onEditOrg` 유무, 팀 조직이면 `myRole !== "member"`)로 가려진다. 이는 `can_edit_org`(owner·admin)와 정확히 일치하므로, 스페이스를 만들 수 없는 일반 멤버에게는 가져오기도 보이지 않는다 — 별도 가드가 필요 없다.

- [ ] **Step 1: Write the failing test**

`apps/extension/src/newtab/NewTab.test.tsx`는 supabase 대신 **`@tablign/core`의 함수들을 모킹**하는 구조다(56행 `vi.mock("@tablign/core", ...)`). 같은 방식으로 `importBookmarks`를 추가한다.

1-1. 다른 `vi.fn()` 선언들 옆(55행 `const updateOrgMemberRole = vi.fn();` 뒤)에 추가:

```tsx
const importBookmarks = vi.fn();
```

1-2. `vi.mock("@tablign/core", ...)`가 반환하는 객체에 추가:

```tsx
    importBookmarks: (...a: unknown[]) => importBookmarks(...a),
```

1-3. `beforeEach`의 다른 `mockReset()` 줄들 옆에 추가:

```tsx
  importBookmarks.mockReset();
  importBookmarks.mockResolvedValue({ space_ids: ["space-new"], first_space_id: "space-new", links: 2 });
```

1-4. 새 describe 블록을 파일 끝에 추가:

```tsx
describe("NewTab — 북마크 가져오기", () => {
  /** beforeEach의 chrome 스텁(tabs·storage)을 유지하면서 bookmarks만 보강한다. */
  function stubBookmarks(children: unknown[]) {
    vi.stubGlobal("chrome", {
      ...(globalThis as unknown as { chrome: object }).chrome,
      bookmarks: {
        getTree: () => Promise.resolve([{ id: "0", title: "", children }]),
      },
    });
  }

  const bar = [{
    id: "1", title: "북마크바", children: [
      { id: "dev", title: "개발", children: [
        { id: "l1", title: "A", url: "https://a.com/1" },
        { id: "l2", title: "B", url: "https://b.com/1" },
      ]},
    ],
  }];

  it("조직 메뉴에서 열면 내 북마크가 미리보기로 나온다", async () => {
    stubBookmarks(bar);
    listSpaces.mockResolvedValue([]);
    renderNewTab();
    await screen.findByText("개인");

    fireEvent.click(screen.getByRole("button", { name: "조직 관리" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "가져오기" }));

    expect(await screen.findByTestId("preview-space-dev")).toBeInTheDocument();
    // 링크 2개가 폴더 직속이므로 공유 폴더 컬렉션 하나가 된다
    expect(screen.getByTestId("preview-col-dev")).toHaveTextContent("공유 폴더");
  });

  it("조직이 개인 하나뿐이면 목적지를 읽기 전용으로 보여준다", async () => {
    stubBookmarks(bar);
    listSpaces.mockResolvedValue([]);
    renderNewTab();
    await screen.findByText("개인");
    fireEvent.click(screen.getByRole("button", { name: "조직 관리" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "가져오기" }));

    expect(await screen.findByTestId("import-org-fixed")).toHaveTextContent("개인");
    expect(screen.queryByLabelText("가져올 조직")).not.toBeInTheDocument();
  });

  it("가져오기를 누르면 계획을 그대로 넘기고 토스트를 띄운다", async () => {
    stubBookmarks(bar);
    listSpaces.mockResolvedValue([]);
    renderNewTab();
    await screen.findByText("개인");
    fireEvent.click(screen.getByRole("button", { name: "조직 관리" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "가져오기" }));
    await screen.findByTestId("preview-space-dev");

    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));

    await waitFor(() => expect(importBookmarks).toHaveBeenCalledTimes(1));
    const [, orgId, plan] = importBookmarks.mock.calls[0] as [unknown, string, {
      spaces: { name: string; collections: { title: string; links: { url: string; favicon_url: string | null }[] }[] }[];
    }];
    expect(orgId).toBe("org-personal");
    expect(plan.spaces).toHaveLength(1);
    expect(plan.spaces[0].name).toBe("개발");
    expect(plan.spaces[0].collections[0].title).toBe("공유 폴더");
    expect(plan.spaces[0].collections[0].links.map((l) => l.url))
      .toEqual(["https://a.com/1", "https://b.com/1"]);
    expect(plan.spaces[0].collections[0].links[0].favicon_url).toBe("https://a.com/favicon.ico");

    expect(await screen.findByText(/스페이스 1개를 만들었어요/)).toBeInTheDocument();
  });

  it("가져오기가 실패하면 다이얼로그를 닫지 않는다", async () => {
    stubBookmarks(bar);
    importBookmarks.mockRejectedValue(new Error("boom"));
    listSpaces.mockResolvedValue([]);
    renderNewTab();
    await screen.findByText("개인");
    fireEvent.click(screen.getByRole("button", { name: "조직 관리" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "가져오기" }));
    await screen.findByTestId("preview-space-dev");

    fireEvent.click(screen.getByRole("button", { name: "가져오기" }));

    expect(await screen.findByText(/가져오지 못했어요/)).toBeInTheDocument();
    expect(screen.getByTestId("preview-space-dev")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tablign/extension test NewTab`
Expected: FAIL — `가져오기` 메뉴 항목을 찾지 못한다

- [ ] **Step 3: Write minimal implementation**

3-1. Modify `apps/extension/public/manifest.json` — `permissions` 배열에 `"bookmarks"` 추가:

```json
"permissions": ["tabs", "storage", "identity", "bookmarks"],
```

3-2. Modify `apps/extension/src/test-setup.ts` — 기존 `vi.stubGlobal("chrome", {...})` 객체에 `bookmarks`를 추가(개별 테스트가 덮어쓸 수 있는 기본값):

```ts
  bookmarks: {
    getTree: () => Promise.resolve([{ id: "0", title: "", children: [] }]),
  },
```

3-3. Modify `apps/extension/src/newtab/OrgHeader.tsx` — props에 `onImport`를 추가하고 메뉴 첫 항목으로 노출:

```tsx
export interface OrgHeaderProps {
  org: Organization;
  myRole: OrgRole;
  onOpenMembers: () => void;
  onEditOrg?: () => void;
  onDeleteOrg?: () => void;
  /** 주면 메뉴 첫 항목으로 '가져오기'를 노출한다 */
  onImport?: () => void;
}

export function OrgHeader({ org, myRole, onOpenMembers, onEditOrg, onDeleteOrg, onImport }: OrgHeaderProps) {
```

`<div role="menu">` 안, 기존 `{!isPersonal && (...)}`(멤버 관리) **앞**에 추가:

```tsx
              {onImport && (
                <button type="button" role="menuitem" style={menuItem}
                  onClick={() => { setMenuOpen(false); onImport(); }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f3f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>가져오기</button>
              )}
```

3-4. Modify `apps/extension/src/newtab/NewTab.tsx`:

**(a)** import 추가 — `@tablign/ui` named import 목록(33행)에 `ImportBookmarksDialog`, `@tablign/core` 목록(38행 부근)에 `fromChromeTree`, `importBookmarks`, `type SourceNode`, `type ImportPlan`.

**(b)** 상태 추가 — 기존 `const [importOpen, setImportOpen] = useState(false);`(419행 부근) 아래. 공유 코드용 `importOpen`과 이름이 겹치지 않게 둔다:

```tsx
  // 북마크 가져오기 (공유 코드 가져오기 importOpen과 별개)
  const [bookmarkImportOpen, setBookmarkImportOpen] = useState(false);
  const [bookmarkRoots, setBookmarkRoots] = useState<SourceNode[]>([]);
```

**(c)** 가져올 수 있는 조직 + 핸들러 — `userId`가 선언된 뒤(849행 부근), `myOrgRole` 계산 근처에 추가:

```tsx
  // 스페이스를 만들 수 있는 조직만 목적지가 된다(RLS의 can_edit_org와 같은 기준:
  // 오너이거나 admin). orgMemberships는 이미 로드돼 있으므로 추가 조회가 없다.
  const importableOrgs = organizations
    .filter((o) => o.owner_id === userId
      || orgMemberships.find((m) => m.org_id === o.id)?.role === "admin")
    .map((o) => ({ id: o.id, name: o.name }));

  async function openBookmarkImport() {
    const tree = await chrome.bookmarks.getTree();
    setBookmarkRoots(fromChromeTree(tree[0]?.children ?? []));
    setBookmarkImportOpen(true);
  }

  async function runBookmarkImport(orgId: string, plan: ImportPlan) {
    const result = await importBookmarks(supabase, orgId, plan);
    setBookmarkImportOpen(false);
    setActiveOrgId(orgId);
    await reloadAll();                    // 스페이스·조직 재조회 (이 파일의 기존 함수명으로 맞춘다)
    setActiveSpaceId(result.first_space_id);
    showToast(`스페이스 ${result.space_ids.length}개를 만들었어요`);
  }
```

> `reloadAll`·`setActiveSpaceId`·`showToast`는 이 파일의 기존 이름으로 바꿔 쓴다(303행 부근의 조직·스페이스 재조회 함수, `useToast()`의 반환). **재조회를 먼저 하고 `setActiveSpaceId`를 호출해야** 새 스페이스가 목록에 이미 있다.

**(d)** `<OrgHeader ... />`(943행 부근)에 진입점 연결:

```tsx
                    onImport={openBookmarkImport}
```

**(e)** 다이얼로그 렌더 — 기존 `<ImportCodeDialog ... />`(1139행 부근) 아래에 추가:

```tsx
      <ImportBookmarksDialog
        open={bookmarkImportOpen}
        roots={bookmarkRoots}
        orgs={importableOrgs}
        defaultOrgId={activeOrgId ?? importableOrgs[0]?.id ?? ""}
        onImport={runBookmarkImport}
        onClose={() => setBookmarkImportOpen(false)}
      />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tablign/extension test NewTab && pnpm --filter @tablign/extension lint`
Expected: 새 테스트 4건 PASS, 기존 테스트 회귀 없음, `tsc --noEmit` 오류 없음

- [ ] **Step 5: Commit**

```bash
git add apps/extension/public/manifest.json apps/extension/src/test-setup.ts apps/extension/src/newtab/OrgHeader.tsx apps/extension/src/newtab/NewTab.tsx apps/extension/src/newtab/NewTab.test.tsx
git commit -m "[기능] 북마크 가져오기 배선·조직 메뉴 진입점"
```

---

### Task 8: 온보딩 진입점

스페이스가 하나도 없는 화면에서도 가져오기로 들어갈 수 있게 한다. 전환이 가장 필요한 순간이다.

**Files:**
- Modify: `packages/ui/src/SpaceOnboarding.tsx`, `apps/extension/src/newtab/NewTab.tsx`
- Test: `packages/ui/src/__tests__/SpaceOnboarding.test.tsx`, `apps/extension/src/newtab/NewTab.test.tsx`

**Interfaces:**
- Consumes: `openBookmarkImport` (Task 7).
- Produces: `SpaceOnboardingProps` += `onImport?: () => void` — 있으면 CTA 아래 보조 행동을 노출.

- [ ] **Step 1: Write the failing test**

Append to `packages/ui/src/__tests__/SpaceOnboarding.test.tsx`:

```tsx
it("onImport를 주면 CTA 아래에 가져오기를 노출한다", () => {
  const onCreate = vi.fn();
  const onImport = vi.fn();
  render(<SpaceOnboarding onCreate={onCreate} onImport={onImport} />);

  fireEvent.click(screen.getByRole("button", { name: /북마크 가져오기/ }));
  expect(onImport).toHaveBeenCalledTimes(1);
  expect(onCreate).not.toHaveBeenCalled();
});

it("onImport가 없으면 가져오기를 노출하지 않는다", () => {
  render(<SpaceOnboarding onCreate={() => {}} />);
  expect(screen.queryByRole("button", { name: /북마크 가져오기/ })).not.toBeInTheDocument();
});
```

Append to the `describe("NewTab — 북마크 가져오기", ...)` block in `apps/extension/src/newtab/NewTab.test.tsx` (Task 7에서 만든 `stubBookmarks`·`bar`를 재사용한다):

```tsx
  it("온보딩 화면에서도 가져오기로 들어갈 수 있다", async () => {
    stubBookmarks(bar);
    listSpaces.mockResolvedValue([]);
    renderNewTab();
    await screen.findByRole("button", { name: /첫 스페이스 만들기/ });

    fireEvent.click(screen.getByRole("button", { name: /북마크 가져오기/ }));

    expect(await screen.findByTestId("preview-space-dev")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tablign/ui test SpaceOnboarding && pnpm --filter @tablign/extension test NewTab`
Expected: FAIL — `북마크 가져오기` 버튼을 찾지 못한다

- [ ] **Step 3: Write minimal implementation**

Modify `packages/ui/src/SpaceOnboarding.tsx`:

```tsx
export interface SpaceOnboardingProps {
  /** CTA(첫 스페이스 만들기) 클릭 시 호출 */
  onCreate: () => void;
  /** 주면 CTA 아래에 보조 행동으로 가져오기를 노출한다 */
  onImport?: () => void;
}

export function SpaceOnboarding({ onCreate, onImport }: SpaceOnboardingProps) {
```

CTA `<Button>` 닫는 태그 바로 뒤에 추가:

```tsx
        {onImport && (
          // 보조 행동: 주 CTA와 경쟁하지 않도록 테두리 없는 링크 형태로 둔다
          <div>
            <button
              type="button"
              onClick={onImport}
              style={{
                marginTop: 10, border: "none", background: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: theme.textMuted,
                padding: "4px 6px", borderRadius: 7,
              }}
            >
              이미 쓰던 북마크 가져오기
            </button>
          </div>
        )}
```

Modify `apps/extension/src/newtab/NewTab.tsx` — `<SpaceOnboarding ... />`에 추가:

```tsx
                    onImport={openBookmarkImport}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @tablign/ui test && pnpm --filter @tablign/extension test && pnpm --filter @tablign/ui lint && pnpm --filter @tablign/extension lint
```
Expected: 전체 PASS, 회귀 없음

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/SpaceOnboarding.tsx packages/ui/src/__tests__/SpaceOnboarding.test.tsx apps/extension/src/newtab/NewTab.tsx apps/extension/src/newtab/NewTab.test.tsx
git commit -m "[기능] 북마크 가져오기 온보딩 진입점"
```

### Task 9: 전체 검증과 실제 브라우저 확인

순수 함수 테스트가 규칙을 보증하지만, Chrome 실제 북마크로 한 번 돌려봐야 `fromChromeTree`의 가정(루트 id, 빈 폴더, 북마클릿)이 맞는지 확인된다.

**Files:** 없음(검증 전용)

- [ ] **Step 1: 전체 테스트·타입 검사**

Run:
```bash
pnpm test && pnpm lint
```
Expected: 전 패키지 PASS. 실패하면 원인 패키지로 돌아가 고치고 다시 실행한다.

- [ ] **Step 2: 익스텐션 빌드**

Run: `pnpm --filter @tablign/extension build`
Expected: 성공. `apps/extension/dist/manifest.json`의 `permissions`에 `bookmarks`가 포함됐는지 확인한다.

- [ ] **Step 3: 실제 브라우저에서 확인**

`chrome://extensions`에서 `apps/extension/dist`를 다시 로드한 뒤(권한이 바뀌었으므로 재로드 필요) 새 탭을 열고 확인한다:

1. 조직 헤더 톱니 → `가져오기` → 다이얼로그가 열리고 **내 실제 북마크 폴더**가 보인다
2. 오른쪽 미리보기의 스페이스·컬렉션 수가 왼쪽 선택과 함께 움직인다
3. 링크 100개 넘는 폴더가 기본 해제돼 있고 안내 문구가 보인다
4. 중복 URL이 있으면 `−n` 배지와 푸터 문구가 보인다
5. `가져오기` → 새 스페이스로 이동하고 토스트가 뜬다
6. 만들어진 보드의 링크 파비콘이 뜨고(없는 사이트는 지구본), `공유 폴더` 컬렉션이 제자리에 있다
7. **Chrome 북마크가 그대로 남아 있다** — `chrome://bookmarks`에서 확인
8. 스페이스를 모두 지운 뒤 새 탭 → 온보딩 화면 CTA 아래 `이미 쓰던 북마크 가져오기`가 보이고 동작한다

- [ ] **Step 4: 발견한 문제를 기록**

실제 북마크에서 예상과 다른 것(빈 폴더가 남는다, 북마클릿이 세어진다, 특정 루트 id가 다르다 등)이 있으면 해당 Task의 테스트에 케이스를 추가하고 고친 뒤 커밋한다. 없으면 이 단계는 넘어간다.

---

## Self-Review

**1. 스펙 커버리지**

| 스펙 요구 | 구현 태스크 |
|---|---|
| §2 규칙 1 (루트는 스페이스 아님, 루트 직속 링크는 루트 이름 스페이스) | Task 2 |
| §2 규칙 2 (1단 폴더 = 스페이스) | Task 2 |
| §2 규칙 3 (자손 폴더 = 컬렉션, 상대 경로 전체) | Task 2 |
| §2 규칙 4 (`공유 폴더`) | Task 2 |
| §2 규칙 5 (빈 것 안 만듦) | Task 2 + Task 4(빈 폴더를 트리에서 제거) |
| §2 규칙 6 (중복 제거, 이번 계획 안) | Task 2 |
| §2 규칙 7 (URL 정규화) | Task 1 |
| §2 규칙 8 (파비콘) | Task 1 |
| §2 규칙 9 (제목 빈 문자열 → null) | Task 2 |
| §2 규칙 10 (position) | Task 5 (RPC) |
| §2 `defaultEnabled` (100개 초과·비 primary 루트) | Task 3 |
| §2 상한 2000 | Task 6 |
| §3 2단 미리보기 다이얼로그 | Task 6 |
| §3 조직 선택(기본 현재 조직, 1개면 읽기 전용) | Task 6(UI) + Task 7(가져올 수 있는 조직 계산) |
| §3 진입점 — 조직 헤더 메뉴 | Task 7 |
| §3 진입점 — 온보딩 | Task 8 |
| §3 공유 코드 가져오기는 그대로 둠 | 변경하지 않음(File Structure에 `AddCollectionButton`·`CollectionOnboarding` 없음) |
| §3 실행 중·직후(가져오는 중…, 실패 시 유지) | Task 6 |
| §3 실행 직후(첫 스페이스 이동, 토스트) | Task 7 |
| §4 필수 권한 `bookmarks` | Task 7 |
| §4 Chrome 북마크는 읽기만 | Task 4·7에 쓰기 코드 없음 + Task 9 Step 3-7에서 실제 확인 |
| §5 `import_bookmarks` RPC, 단일 트랜잭션, `can_edit_org` | Task 5 |
| §6 파일 배치 | File Structure |
| §8 `planImport` 단위 테스트 전부 | Task 1·2·3 |
| §8 RPC 테스트(권한·position) | Task 5 |
| §8 다이얼로그 테스트 | Task 6 |
| 글로벌: http(s) 아닌 링크 제외 | Task 4 |

누락 없음. 스펙 §7의 구현 단계와 태스크 순서도 일치한다(계획 로직 → RPC → 다이얼로그 → 배선 → 진입점).

**2. 플레이스홀더 스캔**

`TBD`·"나중에"·"적절히 처리" 없음. 코드가 필요한 모든 스텝에 실제 코드 블록이 있다.

Task 7의 `reloadAll`·`setActiveSpaceId`·`showToast`는 "이 파일의 기존 이름으로 맞춘다"로 남겼다. 이는 플레이스홀더가 아니라 **1127행짜리 기존 파일에서 확인해야 하는 지점의 명시**다 — 무엇을 찾아야 하는지(303행 부근 재조회 함수, `useToast()` 반환)와 순서 제약(재조회 → `setActiveSpaceId`)을 함께 적었다.

**3. 타입 일관성 확인**

- `SourceNode`·`ImportPlan`·`ImportConfig`·`PlannedSpace`·`PlannedCollection`·`PlannedLink` — Task 2 정의, Task 4·5·6·7에서 동일 이름 사용. ✓
- `normalizeUrl`·`faviconFor`·`isImportableUrl` — Task 1 정의, Task 2(앞 둘)·Task 4(`isImportableUrl`)에서 사용. ✓
- `SHARED_COLLECTION_TITLE`·`MAX_IMPORT_LINKS`·`LARGE_FOLDER_THRESHOLD`·`looseSourceId`·`countLinks` — Task 2·3 정의, Task 6에서 사용. ✓
- `defaultEnabled` — Task 3 정의, Task 6에서 사용. ✓
- `fromChromeTree`·`ChromeBookmarkNode`·`CHROME_BOOKMARKS_BAR_ID` — Task 4 정의, Task 7에서 사용. ✓
- `importBookmarks`·`ImportResult` — Task 5 정의, Task 7에서 사용(테스트에서는 core 함수로 모킹). ✓
- `ImportBookmarksDialog`·`ImportOrgOption`·`ImportBookmarksDialogProps` — Task 6 정의, Task 7에서 사용. ✓
- `onImport` prop — Task 7(`OrgHeaderProps`)·Task 8(`SpaceOnboardingProps`) 양쪽 모두 `onImport?: () => void`로 같은 이름·같은 타입. ✓
- `data-testid` 계약 — Task 6이 만드는 `preview-space-<sourceId>`·`preview-col-<sourceId>`·`import-summary`·`import-org-fixed`·`tree-row-<id>`·`large-folder-note`·`over-limit-note`를 Task 7·8 테스트가 같은 이름으로 조회한다. ✓
- 기존 `importOpen`(공유 코드)과 새 `bookmarkImportOpen`이 충돌하지 않도록 Task 7에서 다른 이름을 명시. ✓
- **삭제된 `listMyOrgRoles`** — 초안에 있던 신규 조회 함수는 기존 `listMyOrgMemberships`(`packages/core/src/data/organizations.ts:36`)와 `NewTab`의 `orgMemberships` 상태로 대체돼 태스크에서 제거했다. 계획 어디에도 참조가 남아 있지 않다. ✓
