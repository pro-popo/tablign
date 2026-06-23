# 중복 줄이기 리팩터 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 웹/확장에 흩어진 공통 로직(패널 상태, 정렬 헬퍼)을 공유 패키지로 모으고 죽은 코드를 제거해, 설계 원칙 #2("클라이언트 간 코드 공유")를 실제로 지킨다.

**Architecture:** 플랫폼 차이가 있는 부분은 "코어 로직은 공유 + 플랫폼 의존부는 어댑터 주입" 패턴으로 통일한다. `usePanelState`는 `@tablign/ui`에 저장소-주입형 훅으로 옮기고, 각 앱은 얇은 어댑터만 둔다. 정렬 헬퍼는 `@tablign/core`로 옮겨 단일 출처화한다.

**Tech Stack:** React 18, TypeScript 5.5, Vitest 2 + Testing Library, pnpm 워크스페이스, Vite(확장)/Next 15(웹).

## Global Constraints

- 스타일링/상태 라이브러리 신규 도입 금지 — 기존 스택(인라인 style + `theme` 토큰, react-query는 웹만)을 유지한다.
- `@tablign/ui`는 빌드 없이 소스(`./src/index.ts`)로 export된다 — 새 모듈은 반드시 `packages/ui/src/index.ts`에서 재export한다.
- `@tablign/core`는 React 의존성이 없다 — React 훅을 core에 두지 않는다(훅은 ui).
- 패널 저장 키 문자열은 `"tablign.panels"`로 **변경 없이 유지**(기존 사용자 저장값 호환).
- position 간격 상수는 `GAP = 1000`을 단일 출처로 쓴다.
- 커밋은 사용자가 명시적으로 허락할 때만 한다(각 Task의 commit 스텝은 실행 시 승인 후 진행).

---

### Task 1: `@tablign/ui`에 저장소 주입형 `usePanelState` 훅 추가

**Files:**
- Create: `packages/ui/src/usePanelState.ts`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/src/__tests__/usePanelState.test.tsx`

**Interfaces:**
- Produces:
  - `interface PanelState { left: boolean; right: boolean }`
  - `const PANEL_STATE_KEY: string` (= `"tablign.panels"`)
  - `function isPanelState(v: unknown): v is PanelState`
  - `interface PanelStateStorage { read: (cb: (state: PanelState | null) => void) => void; write: (state: PanelState) => void }`
  - `function usePanelState(storage: PanelStateStorage): { state: PanelState; toggleLeft: () => void; toggleRight: () => void }`

- [ ] **Step 1: Write the failing test**

`packages/ui/src/__tests__/usePanelState.test.tsx`:
```tsx
import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePanelState, type PanelState, type PanelStateStorage } from "../usePanelState";

function fakeStorage(initial: PanelState | null) {
  const box = { saved: initial };
  const adapter: PanelStateStorage = {
    read: (cb) => cb(box.saved),
    write: (s) => { box.saved = s; },
  };
  return { adapter, box };
}

describe("usePanelState (shared)", () => {
  it("저장값이 없으면 기본값(둘 다 열림)을 반환한다", () => {
    const { adapter } = fakeStorage(null);
    const { result } = renderHook(() => usePanelState(adapter));
    expect(result.current.state).toEqual({ left: true, right: true });
  });

  it("저장된 상태를 초기에 읽어온다", () => {
    const { adapter } = fakeStorage({ left: false, right: true });
    const { result } = renderHook(() => usePanelState(adapter));
    expect(result.current.state).toEqual({ left: false, right: true });
  });

  it("toggleLeft가 상태를 뒤집고 저장한다", () => {
    const { adapter, box } = fakeStorage(null);
    const { result } = renderHook(() => usePanelState(adapter));
    act(() => result.current.toggleLeft());
    expect(result.current.state).toEqual({ left: false, right: true });
    expect(box.saved).toEqual({ left: false, right: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tablign/ui exec vitest run src/__tests__/usePanelState.test.tsx`
Expected: FAIL — `Cannot find module "../usePanelState"`.

- [ ] **Step 3: Write minimal implementation**

`packages/ui/src/usePanelState.ts`:
```ts
import { useEffect, useState } from "react";

export interface PanelState {
  left: boolean;
  right: boolean;
}

export const PANEL_STATE_KEY = "tablign.panels";
const DEFAULT: PanelState = { left: true, right: true };

export function isPanelState(v: unknown): v is PanelState {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as PanelState).left === "boolean" &&
    typeof (v as PanelState).right === "boolean"
  );
}

/** 플랫폼별 영속화(localStorage / chrome.storage)를 주입하는 어댑터. read는 비동기(콜백) 허용. */
export interface PanelStateStorage {
  read: (cb: (state: PanelState | null) => void) => void;
  write: (state: PanelState) => void;
}

export function usePanelState(storage: PanelStateStorage) {
  const [state, setState] = useState<PanelState>(DEFAULT);

  useEffect(() => {
    storage.read((s) => { if (s) setState(s); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(key: keyof PanelState) {
    setState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      storage.write(next);
      return next;
    });
  }

  return { state, toggleLeft: () => toggle("left"), toggleRight: () => toggle("right") };
}
```

`packages/ui/src/index.ts` — 기존 export 목록 끝에 추가:
```ts
export * from "./usePanelState";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tablign/ui exec vitest run src/__tests__/usePanelState.test.tsx`
Expected: PASS (3 tests).
그리고 타입체크: `pnpm --filter @tablign/ui exec tsc --noEmit` → 출력 없음(성공).

- [ ] **Step 5: Commit** (사용자 승인 후)

```bash
git add packages/ui/src/usePanelState.ts packages/ui/src/index.ts packages/ui/src/__tests__/usePanelState.test.tsx
git commit -m "[개선] 공유 usePanelState 훅 추가(저장소 어댑터 주입)"
```

---

### Task 2: 웹을 공유 `usePanelState`로 전환

**Files:**
- Modify: `apps/web/src/lib/usePanelState.ts` (전체 재작성)
- Test: `apps/web/src/lib/usePanelState.test.ts` (변경 없음 — 그대로 통과해야 함)

**Interfaces:**
- Consumes: Task 1의 `usePanelState`, `PanelStateStorage`, `PanelState`, `PANEL_STATE_KEY`.
- Produces: `usePanelState()`(인자 없음), `readPanelState`, `writePanelState`, `PanelState` 재export — 기존 테스트/소비처 호환 유지.

- [ ] **Step 1: 기존 웹 테스트가 통과 중인지 먼저 확인(기준선)**

Run: `pnpm --filter @tablign/web exec vitest run src/lib/usePanelState.test.ts`
Expected: PASS (3 tests). 이 테스트는 `readPanelState`/`writePanelState`를 검증하므로 두 함수는 유지한다.

- [ ] **Step 2: 웹 파일 재작성(공유 훅 + localStorage 어댑터)**

`apps/web/src/lib/usePanelState.ts`:
```ts
"use client";

import {
  usePanelState as useShared,
  PANEL_STATE_KEY,
  type PanelState,
  type PanelStateStorage,
} from "@tablign/ui";

const DEFAULT: PanelState = { left: true, right: true };

export function readPanelState(storage: Pick<Storage, "getItem">): PanelState {
  try {
    const raw = storage.getItem(PANEL_STATE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.left === "boolean" && typeof parsed?.right === "boolean") {
      return { left: parsed.left, right: parsed.right };
    }
    return DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function writePanelState(storage: Pick<Storage, "setItem">, state: PanelState): void {
  try {
    storage.setItem(PANEL_STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

const adapter: PanelStateStorage = {
  read: (cb) => cb(readPanelState(window.localStorage)),
  write: (state) => writePanelState(window.localStorage, state),
};

export function usePanelState() {
  return useShared(adapter);
}

export type { PanelState };
```

- [ ] **Step 3: 웹 테스트와 타입체크로 검증**

Run: `pnpm --filter @tablign/web exec vitest run src/lib/usePanelState.test.ts`
Expected: PASS (3 tests, 변경 없이).
Run: `pnpm --filter @tablign/web exec tsc --noEmit`
Expected: 출력 없음(성공). (`DashboardClient`의 `usePanelState()` 호출 시그니처가 그대로라 깨지지 않음.)

- [ ] **Step 4: Commit** (사용자 승인 후)

```bash
git add apps/web/src/lib/usePanelState.ts
git commit -m "[개선] 웹 usePanelState를 공유 훅으로 전환"
```

---

### Task 3: 확장을 공유 `usePanelState`로 전환

**Files:**
- Modify: `apps/extension/src/lib/usePanelState.ts` (전체 재작성)

**Interfaces:**
- Consumes: Task 1의 `usePanelState`, `isPanelState`, `PanelStateStorage`, `PANEL_STATE_KEY`.
- Produces: `usePanelState()`(인자 없음) — `NewTab.tsx`의 기존 호출 호환.

- [ ] **Step 1: 확장 파일 재작성(공유 훅 + chrome.storage 어댑터)**

`apps/extension/src/lib/usePanelState.ts`:
```ts
import {
  usePanelState as useShared,
  isPanelState,
  PANEL_STATE_KEY,
  type PanelStateStorage,
} from "@tablign/ui";

const adapter: PanelStateStorage = {
  read: (cb) => {
    chrome.storage.local.get(PANEL_STATE_KEY, (res) => {
      const v = res[PANEL_STATE_KEY];
      cb(isPanelState(v) ? v : null);
    });
  },
  write: (state) => {
    chrome.storage.local.set({ [PANEL_STATE_KEY]: state });
  },
};

export function usePanelState() {
  return useShared(adapter);
}
```

- [ ] **Step 2: 타입체크 / 테스트 / 빌드로 검증**

Run: `pnpm --filter @tablign/extension lint`
Expected: 출력 없음(성공, `tsc --noEmit`).
Run: `pnpm --filter @tablign/extension test`
Expected: 기존 테스트 전부 PASS.
Run: `pnpm --filter @tablign/extension build`
Expected: `✓ built` 로 종료.

- [ ] **Step 3: Commit** (사용자 승인 후)

```bash
git add apps/extension/src/lib/usePanelState.ts
git commit -m "[개선] 확장 usePanelState를 공유 훅으로 전환"
```

---

### Task 4: 정렬 헬퍼를 `@tablign/core`로 통합

**Files:**
- Modify: `packages/core/src/position.ts` (헬퍼 2개 추가)
- Create: `packages/core/src/__tests__/order.test.ts`
- Modify: `apps/extension/src/newtab/NewTab.tsx` (import 출처 변경)
- Delete: `apps/extension/src/lib/order.ts`, `apps/extension/src/lib/order.test.ts`

**Interfaces:**
- Produces (from `@tablign/core`):
  - `function placeInOrder(currentIds: string[], insertId: string, beforeId: string | null): string[]`
  - `function sequentialPositions(orderedIds: string[]): { id: string; position: number }[]`
- Consumes: 기존 `GAP` 상수(`packages/core/src/position.ts`).

- [ ] **Step 1: core에 헬퍼 추가**

`packages/core/src/position.ts` 끝에 추가:
```ts
/**
 * 현재 순서(id 배열)에서 insertId를 beforeId 앞으로(없으면 맨 끝) 옮긴 새 순서를 만든다.
 * insertId가 목록에 있으면 제거 후 재삽입(재정렬), 없으면 새로 삽입(타 컨테이너 이동).
 */
export function placeInOrder(currentIds: string[], insertId: string, beforeId: string | null): string[] {
  const ids = currentIds.filter((id) => id !== insertId);
  const idx = beforeId && beforeId !== insertId ? ids.indexOf(beforeId) : -1;
  const at = idx >= 0 ? idx : ids.length;
  ids.splice(at, 0, insertId);
  return ids;
}

/** 순서대로 GAP 간격의 position을 부여한다(동일 position로 정렬이 무력화되는 문제 방지). */
export function sequentialPositions(orderedIds: string[]): { id: string; position: number }[] {
  return orderedIds.map((id, i) => ({ id, position: (i + 1) * GAP }));
}
```
(`@tablign/core`의 `index.ts`는 이미 `export * from "./position"` 하므로 추가 export 불필요.)

- [ ] **Step 2: core 테스트 작성 및 실행**

`packages/core/src/__tests__/order.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { placeInOrder, sequentialPositions } from "../position";

describe("placeInOrder", () => {
  it("새 항목을 특정 항목 앞에 삽입한다", () => {
    expect(placeInOrder(["a", "b", "c"], "d", "b")).toEqual(["a", "d", "b", "c"]);
  });
  it("beforeId가 null이면 맨 끝에 삽입한다", () => {
    expect(placeInOrder(["a", "b", "c"], "d", null)).toEqual(["a", "b", "c", "d"]);
  });
  it("같은 목록 내 재정렬: 자기 자신을 제거하고 대상 앞으로 옮긴다", () => {
    expect(placeInOrder(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
  });
  it("알 수 없는 beforeId는 맨 끝", () => {
    expect(placeInOrder(["a", "b"], "c", "zzz")).toEqual(["a", "b", "c"]);
  });
});

describe("sequentialPositions", () => {
  it("순서 인덱스에 1000 간격 position을 부여한다", () => {
    expect(sequentialPositions(["a", "b", "c"])).toEqual([
      { id: "a", position: 1000 },
      { id: "b", position: 2000 },
      { id: "c", position: 3000 },
    ]);
  });
});
```
Run: `pnpm --filter @tablign/core test`
Expected: 신규 order 테스트 포함 전부 PASS.

- [ ] **Step 3: 확장 import 출처 변경**

`apps/extension/src/newtab/NewTab.tsx` 34번째 줄을 교체:
```ts
// before
import { placeInOrder, sequentialPositions } from "../lib/order";
// after  (placeInOrder는 현재 NewTab에서 미사용 → sequentialPositions만 가져온다)
import { sequentialPositions } from "@tablign/core";
```
주의: `@tablign/core`는 NewTab 상단에서 이미 import 중이므로(예: `updateCollection`, `Collection`), 별도 import 라인을 추가하지 말고 **기존 `@tablign/core` import 구문에 `sequentialPositions`를 합쳐도 된다.** 둘 중 한 방식만 적용해 중복 import를 만들지 않는다.

- [ ] **Step 4: 중복 파일 삭제**

```bash
git rm apps/extension/src/lib/order.ts apps/extension/src/lib/order.test.ts
```

- [ ] **Step 5: 확장/코어 검증**

Run: `pnpm --filter @tablign/core test` → PASS
Run: `pnpm --filter @tablign/extension lint` → 출력 없음(성공)
Run: `pnpm --filter @tablign/extension test` → PASS
Run: `pnpm --filter @tablign/extension build` → `✓ built`

- [ ] **Step 6: Commit** (사용자 승인 후)

```bash
git add packages/core/src/position.ts packages/core/src/__tests__/order.test.ts apps/extension/src/newtab/NewTab.tsx
git commit -m "[개선] 정렬 헬퍼를 core로 통합하고 확장 중복 제거"
```

---

### Task 5: 죽은 코드 제거 (`BoardDnd.tsx`)

**Files:**
- Delete: `apps/web/src/app/dashboard/BoardDnd.tsx`

**근거:** `BoardDnd`는 어디에서도 import되지 않는다(`grep -rn "BoardDnd" apps`는 정의 파일만 매치). 웹은 현재 컬렉션/링크 재정렬 DnD가 연결돼 있지 않다.

- [ ] **Step 1: 미사용 재확인**

Run: `grep -rn "BoardDnd" apps packages`
Expected: `apps/web/src/app/dashboard/BoardDnd.tsx` 내부 정의 라인만 출력(외부 import 없음). 만약 import가 있으면 이 Task를 중단한다.

- [ ] **Step 2: 삭제**

```bash
git rm apps/web/src/app/dashboard/BoardDnd.tsx
```

- [ ] **Step 3: 웹 타입체크/빌드**

Run: `pnpm --filter @tablign/web exec tsc --noEmit` → 출력 없음(성공)
Run: `pnpm --filter @tablign/web build` → 성공

- [ ] **Step 4: Commit** (사용자 승인 후)

```bash
git add -A
git commit -m "[개선] 미사용 BoardDnd 컴포넌트 제거"
```

---

## 범위 밖 (별도 계획 권장)

다음은 이번 계획에 포함하지 않는다 — 규모·위험이 크거나 "현재 중복"이 아니기 때문:

1. **데이터 패칭 패러다임 통합** — 확장(직접 supabase + useState) vs 웹(react-query). 확장을 react-query로 옮기거나 공유 데이터 훅을 추출하는 건 대규모 변경이라 독립 스펙 필요.
2. **UI 컨테이너 통합**(`Sidebar`/`SearchBar`/`Toolbar` vs `ExtSidebar`/`ExtSearchBar`/NewTab 인라인 헤더) — 플랫폼별 차이(URL 라우팅 vs chrome.storage, 태그 패널 유무)가 커서 별도 설계 필요.
3. **`positionBetween`(분수 전략) 정리** — 현재 테스트에서만 쓰이는 미사용 유틸. 재정렬 전략을 분수 방식으로 통일할지 결정이 선행돼야 함(YAGNI상 제거 후보지만 의도된 유틸일 수 있어 보류).

## Self-Review

- **Spec coverage:** 식별된 "현재 중복"(usePanelState)은 Task 1–3, "미래 중복/산재"(정렬 헬퍼)는 Task 4, "죽은 코드"는 Task 5가 커버. 큰 항목은 범위 밖에 명시.
- **Placeholder scan:** 모든 코드 스텝에 실제 코드/명령/기대 출력 포함. 자리표시자 없음.
- **Type consistency:** `PanelStateStorage`, `PanelState`, `PANEL_STATE_KEY`, `isPanelState`, `usePanelState(storage)`, `placeInOrder`/`sequentialPositions` 시그니처가 Task 간 일치.
