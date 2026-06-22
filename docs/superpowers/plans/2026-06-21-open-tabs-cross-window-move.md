# 열린 탭 창 간 이동 (DnD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "열린 탭" 패널에서 탭을 드래그해 다른 창의 특정 위치로 이동(및 같은 창 내 재정렬)할 수 있게 하고, 실제 브라우저 탭을 `chrome.tabs.move`로 옮긴다.

**Architecture:** 기존 컬렉션 DnD 패턴(`@dnd-kit/sortable`의 `useSortable` + 실시간 미리보기)을 창/탭에 확장한다. 재배치/대상판정은 `tabs.ts`의 순수 함수로 분리해 단위 테스트하고, `NewTab.tsx`의 DnD 핸들러가 이를 호출해 실시간 미리보기 후 드롭 시 `chrome.tabs.move`로 확정한다. 기존 "탭 → 컬렉션 저장" 동작은 그대로 공존한다.

**Tech Stack:** React 18, TypeScript, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, Vitest + jsdom + @testing-library/react, Chrome Extension Manifest v3 (`chrome.tabs` API).

## Global Constraints

- 모든 테스트/린트 명령은 `apps/extension` 디렉터리에서 실행한다.
- 단위 테스트: `pnpm exec vitest run <file>` (vitest 환경: jsdom, globals, setup `./src/test-setup.ts`).
- 린트(타입 체크): `pnpm lint` (= `tsc --noEmit`).
- 탭 드래그 id 형식은 기존과 동일하게 `tab-{tab.id}`, data는 `{ kind: "tab", tab }`.
- 창 간 이동은 **모든 탭** 허용 (chrome:// 포함, http 필터 없음). 컬렉션 저장만 기존대로 http(s) 필터 유지.
- 기존 동작/공개 인터페이스(`OpenTabsPanelProps`, 컬렉션 저장)는 변경하지 않는다.
- 커밋 메시지 본문은 제목만으로 부족할 때만 간단히 추가한다(저장소 관례).

---

### Task 1: `moveTab` 순수 재배치 함수 (tabs.ts)

드래그 중 `groups` 상태에서 탭을 재배치하는 순수 함수. 같은 창이면 splice 재정렬, 다른 창이면 제거 후 삽입.

**Files:**
- Modify: `apps/extension/src/lib/tabs.ts` (파일 끝에 추가)
- Test: `apps/extension/src/lib/tabs.test.ts` (`describe` 블록 추가)

**Interfaces:**
- Consumes: `WindowGroup`, `WindowTab` (tabs.ts 기존 타입, lines 29-40)
- Produces: `moveTab(groups: WindowGroup[], tabId: number, toWindowId: number, toIndex: number): WindowGroup[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/extension/src/lib/tabs.test.ts` 파일 끝에 추가:

```ts
import { moveTab } from "./tabs";

describe("moveTab", () => {
  const groups: WindowGroup[] = [
    { windowId: 10, tabs: [
      { id: 1, windowId: 10, url: "https://a.com", title: "A" },
      { id: 2, windowId: 10, url: "https://b.com", title: "B" },
      { id: 3, windowId: 10, url: "https://c.com", title: "C" },
    ] },
    { windowId: 20, tabs: [
      { id: 4, windowId: 20, url: "https://d.com", title: "D" },
    ] },
  ];

  it("같은 창 내에서 앞→뒤로 재정렬한다", () => {
    const r = moveTab(groups, 1, 10, 2);
    expect(r[0].tabs.map((t) => t.id)).toEqual([2, 3, 1]);
    expect(r[1].tabs.map((t) => t.id)).toEqual([4]);
  });

  it("같은 창 내에서 뒤→앞으로 재정렬한다", () => {
    const r = moveTab(groups, 3, 10, 0);
    expect(r[0].tabs.map((t) => t.id)).toEqual([3, 1, 2]);
  });

  it("다른 창의 특정 index로 이동하고 windowId를 갱신한다", () => {
    const r = moveTab(groups, 1, 20, 0);
    expect(r[0].tabs.map((t) => t.id)).toEqual([2, 3]);
    expect(r[1].tabs.map((t) => t.id)).toEqual([1, 4]);
    expect(r[1].tabs.find((t) => t.id === 1)?.windowId).toBe(20);
  });

  it("대상 창의 끝(길이 이상 index)으로 이동한다", () => {
    const r = moveTab(groups, 1, 20, 99);
    expect(r[1].tabs.map((t) => t.id)).toEqual([4, 1]);
  });

  it("탭/대상 창이 없으면 원본을 그대로 반환한다", () => {
    expect(moveTab(groups, 999, 10, 0)).toBe(groups);
    expect(moveTab(groups, 1, 999, 0)).toBe(groups);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd apps/extension && pnpm exec vitest run src/lib/tabs.test.ts`
Expected: FAIL — `moveTab` is not exported / not a function.

- [ ] **Step 3: 최소 구현**

`apps/extension/src/lib/tabs.ts` 파일 끝에 추가:

```ts
/**
 * 드래그 중 groups 상태에서 탭을 재배치한다(순수).
 * 같은 창이면 splice로 재정렬, 다른 창이면 원본에서 제거 후 대상 창의 toIndex에 삽입한다.
 * toIndex는 0-based 삽입 위치이며 범위를 벗어나면 클램프한다.
 * 옮길 탭이 없거나 대상 창이 없으면 원본 배열을 그대로 반환한다.
 */
export function moveTab(
  groups: WindowGroup[],
  tabId: number,
  toWindowId: number,
  toIndex: number,
): WindowGroup[] {
  if (!groups.some((g) => g.windowId === toWindowId)) return groups;
  let from: { windowId: number; index: number; tab: WindowTab } | null = null;
  for (const g of groups) {
    const index = g.tabs.findIndex((t) => t.id === tabId);
    if (index >= 0) { from = { windowId: g.windowId, index, tab: g.tabs[index] }; break; }
  }
  if (!from) return groups;

  if (from.windowId === toWindowId) {
    return groups.map((g) => {
      if (g.windowId !== toWindowId) return g;
      const tabs = [...g.tabs];
      const [item] = tabs.splice(from!.index, 1);
      const idx = Math.max(0, Math.min(toIndex, tabs.length));
      tabs.splice(idx, 0, item);
      return { ...g, tabs };
    });
  }

  const moving: WindowTab = { ...from.tab, windowId: toWindowId };
  return groups.map((g) => {
    if (g.windowId === from!.windowId) return { ...g, tabs: g.tabs.filter((t) => t.id !== tabId) };
    if (g.windowId === toWindowId) {
      const idx = Math.max(0, Math.min(toIndex, g.tabs.length));
      return { ...g, tabs: [...g.tabs.slice(0, idx), moving, ...g.tabs.slice(idx)] };
    }
    return g;
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd apps/extension && pnpm exec vitest run src/lib/tabs.test.ts`
Expected: PASS — 모든 `moveTab` 테스트 통과.

- [ ] **Step 5: 커밋**

```bash
git add apps/extension/src/lib/tabs.ts apps/extension/src/lib/tabs.test.ts
git commit -m "[기능] moveTab 순수 재배치 함수 추가"
```

---

### Task 2: 드롭 대상 판정 순수 함수 (tabs.ts)

`over` 대상이 "열린 탭" 창 영역인지 판정하고 대상 창/삽입 index를 계산하는 순수 함수, 그리고 `tab-{id}` 파싱 헬퍼.

**Files:**
- Modify: `apps/extension/src/lib/tabs.ts` (파일 끝에 추가)
- Test: `apps/extension/src/lib/tabs.test.ts` (`describe` 블록 추가)

**Interfaces:**
- Consumes: `WindowGroup` (tabs.ts), Task 1과 동일 파일
- Produces:
  - `parseTabDragId(id: string): number | null`
  - `interface TabDropTarget { toWindowId: number; toIndex: number }`
  - `resolveTabDropTarget(groups: WindowGroup[], overId: string): TabDropTarget | null`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/extension/src/lib/tabs.test.ts` 파일 끝에 추가:

```ts
import { parseTabDragId, resolveTabDropTarget } from "./tabs";

describe("parseTabDragId", () => {
  it("tab-123 → 123", () => {
    expect(parseTabDragId("tab-123")).toBe(123);
  });
  it("tab 접두사가 아니면 null", () => {
    expect(parseTabDragId("container:abc")).toBeNull();
    expect(parseTabDragId("window:10")).toBeNull();
  });
  it("숫자가 아니면 null", () => {
    expect(parseTabDragId("tab-abc")).toBeNull();
  });
});

describe("resolveTabDropTarget", () => {
  const groups: WindowGroup[] = [
    { windowId: 10, tabs: [
      { id: 1, windowId: 10, url: "https://a.com" },
      { id: 2, windowId: 10, url: "https://b.com" },
    ] },
    { windowId: 20, tabs: [] },
  ];

  it("window:{wid}는 해당 창의 끝 index를 돌려준다", () => {
    expect(resolveTabDropTarget(groups, "window:10")).toEqual({ toWindowId: 10, toIndex: 2 });
    expect(resolveTabDropTarget(groups, "window:20")).toEqual({ toWindowId: 20, toIndex: 0 });
  });

  it("tab-{id}는 그 탭이 속한 창과 그 탭의 index를 돌려준다", () => {
    expect(resolveTabDropTarget(groups, "tab-2")).toEqual({ toWindowId: 10, toIndex: 1 });
  });

  it("컬렉션 대상(container:/링크 id)이면 null", () => {
    expect(resolveTabDropTarget(groups, "container:c1")).toBeNull();
    expect(resolveTabDropTarget(groups, "some-link-uuid")).toBeNull();
  });

  it("존재하지 않는 창/탭이면 null", () => {
    expect(resolveTabDropTarget(groups, "window:999")).toBeNull();
    expect(resolveTabDropTarget(groups, "tab-999")).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd apps/extension && pnpm exec vitest run src/lib/tabs.test.ts`
Expected: FAIL — `parseTabDragId` / `resolveTabDropTarget` not exported.

- [ ] **Step 3: 최소 구현**

`apps/extension/src/lib/tabs.ts` 파일 끝에 추가:

```ts
/** 드래그 id `tab-123` → 123. tab 접두사가 아니거나 숫자가 아니면 null. */
export function parseTabDragId(id: string): number | null {
  if (!id.startsWith("tab-")) return null;
  const n = Number(id.slice("tab-".length));
  return Number.isFinite(n) ? n : null;
}

export interface TabDropTarget {
  toWindowId: number;
  toIndex: number;
}

/**
 * onDragOver/End의 over 대상이 "열린 탭" 창 영역인지 판정하고 대상 창/삽입 index를 계산한다.
 * - overId === `window:{wid}` → 해당 창의 끝
 * - overId === `tab-{id}`     → 그 탭이 속한 창의 그 탭 위치
 * 창/탭 대상이 아니면(=컬렉션) null.
 */
export function resolveTabDropTarget(groups: WindowGroup[], overId: string): TabDropTarget | null {
  if (overId.startsWith("window:")) {
    const wid = Number(overId.slice("window:".length));
    const g = groups.find((x) => x.windowId === wid);
    return g ? { toWindowId: wid, toIndex: g.tabs.length } : null;
  }
  const tid = parseTabDragId(overId);
  if (tid == null) return null;
  for (const g of groups) {
    const idx = g.tabs.findIndex((t) => t.id === tid);
    if (idx >= 0) return { toWindowId: g.windowId, toIndex: idx };
  }
  return null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd apps/extension && pnpm exec vitest run src/lib/tabs.test.ts`
Expected: PASS — Task 1, 2의 모든 테스트 통과.

- [ ] **Step 5: 커밋**

```bash
git add apps/extension/src/lib/tabs.ts apps/extension/src/lib/tabs.test.ts
git commit -m "[기능] 탭 드롭 대상 판정 함수(resolveTabDropTarget) 추가"
```

---

### Task 3: OpenTabsPanel — 탭 sortable + 창 droppable

탭 행을 `useSortable`로 전환하고, 각 창 그룹을 droppable 컨테이너(`window:{windowId}`)로 만들어 SortableContext로 감싼다.

**Files:**
- Modify: `apps/extension/src/newtab/OpenTabsPanel.tsx` (전체 재작성)
- Test: `apps/extension/src/newtab/OpenTabsPanel.test.tsx` (테스트 추가)

**Interfaces:**
- Consumes: `WindowGroup`, `WindowTab` (tabs.ts); `@tablign/ui`의 `Favicon, ChevronDown, Download, X, PanelRightClose, theme`
- Produces: 탭은 `useSortable({ id: ` + "`" + `tab-${tab.id}` + "`" + `, data: { kind: "tab", tab } })`, 각 창은 `useDroppable({ id: ` + "`" + `window:${windowId}` + "`" + `, data: { kind: "window", windowId } })`로 렌더링. `OpenTabsPanelProps` 시그니처는 변경 없음.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/extension/src/newtab/OpenTabsPanel.test.tsx`의 `groups` 상수에 두 번째 창을 추가하고, 새 테스트를 `describe` 안에 추가한다.

먼저 상단 `groups`를 다음으로 교체:

```ts
const groups: WindowGroup[] = [
  { windowId: 10, tabs: [
    { id: 1, windowId: 10, url: "https://a.com", title: "탭 A", favIconUrl: undefined },
    { id: 2, windowId: 10, url: "https://b.com", title: "탭 B", favIconUrl: undefined },
  ] },
  { windowId: 20, tabs: [
    { id: 3, windowId: 20, url: "https://c.com", title: "탭 C", favIconUrl: undefined },
  ] },
];
```

`describe` 블록 안에 테스트 추가:

```ts
it("창이 여러 개면 각 창의 탭을 모두 보여준다", () => {
  renderPanel();
  expect(screen.getByText("창 1")).toBeInTheDocument();
  expect(screen.getByText("창 2")).toBeInTheDocument();
  expect(screen.getByText("탭 A")).toBeInTheDocument();
  expect(screen.getByText("탭 C")).toBeInTheDocument();
});

it("두 번째 창의 저장 버튼이 onSaveWindow(20)을 호출한다", () => {
  const onSaveWindow = vi.fn();
  renderPanel({ onSaveWindow });
  fireEvent.click(screen.getByRole("button", { name: "창 2 전체 저장" }));
  expect(onSaveWindow).toHaveBeenCalledWith(20);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd apps/extension && pnpm exec vitest run src/newtab/OpenTabsPanel.test.tsx`
Expected: FAIL — "창 2" 텍스트/버튼을 찾지 못함(아직 두 번째 창 데이터 기준 단언 미충족) 또는 신규 테스트 미정의로 실패.

> 참고: 기존 컴포넌트가 이미 여러 창을 렌더링하므로 일부 단언은 통과할 수 있다. 이 단계의 목적은 신규 테스트가 추가되어 실행되는 것을 확인하는 것이다. Step 3에서 컴포넌트를 sortable/droppable 구조로 바꾼 뒤에도 동일 테스트가 통과해야 한다.

- [ ] **Step 3: 컴포넌트 재작성**

`apps/extension/src/newtab/OpenTabsPanel.tsx` 전체를 다음으로 교체:

```tsx
import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Download, X, PanelRightClose, Favicon, theme } from "@tablign/ui";
import type { WindowGroup, WindowTab } from "../lib/tabs";

function TabRow({ tab, onCloseTab }: { tab: WindowTab; onCloseTab: (id: number) => void }) {
  const [hover, setHover] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `tab-${tab.id}`,
    data: { kind: "tab", tab },
  });
  const style: React.CSSProperties = {
    display: "flex", gap: 8, alignItems: "center",
    border: `1px solid ${theme.border}`, borderRadius: 9, padding: "8px 9px", background: "#fff",
    // 드래그 중인 행은 슬롯에 고정(transform 억제), 주변 행만 슬라이드. 커서 추적은 DragOverlay 담당.
    transform: isDragging ? undefined : CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: "grab",
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Favicon url={tab.favIconUrl ?? null} />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {tab.title ?? tab.url}
      </span>
      <button type="button" title="탭 닫기" aria-label={`${tab.title ?? tab.url} 닫기`} onPointerDown={(e) => e.stopPropagation()} onClick={() => tab.id != null && onCloseTab(tab.id)}
        style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 2, opacity: hover ? 1 : 0, pointerEvents: hover ? "auto" : "none", transition: "opacity .12s" }}>
        <X size={14} color={theme.textFaint} />
      </button>
    </div>
  );
}

function WindowGroupView({
  group, index, onSaveWindow, onCloseWindow, onCloseTab,
}: {
  group: WindowGroup;
  index: number;
  onSaveWindow: (windowId: number) => void;
  onCloseWindow: (windowId: number) => void;
  onCloseTab: (tabId: number) => void;
}) {
  // 빈 창에도 드롭할 수 있도록 탭 목록 컨테이너 자체를 droppable로.
  const { setNodeRef } = useDroppable({ id: `window:${group.windowId}`, data: { kind: "window", windowId: group.windowId } });
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: theme.textMuted, marginBottom: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><ChevronDown size={15} /> 창 {index + 1}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button type="button" title="이 창의 탭 전체 저장" aria-label={`창 ${index + 1} 전체 저장`} onClick={() => onSaveWindow(group.windowId)}
            style={{ border: "none", background: "none", cursor: "pointer", display: "flex", color: theme.accent }}>
            <Download size={15} />
          </button>
          <button type="button" title="이 창의 탭 전체 닫기" aria-label={`창 ${index + 1} 닫기`} onClick={() => onCloseWindow(group.windowId)}
            style={{ border: "none", background: "none", cursor: "pointer", display: "flex", color: theme.textFaint }}>
            <X size={15} />
          </button>
        </span>
      </div>
      <SortableContext items={group.tabs.map((t) => `tab-${t.id}`)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 10 }}>
          {group.tabs.map((t) => <TabRow key={t.id} tab={t} onCloseTab={onCloseTab} />)}
        </div>
      </SortableContext>
    </div>
  );
}

export interface OpenTabsPanelProps {
  groups: WindowGroup[];
  onSaveWindow: (windowId: number) => void;
  onCloseWindow: (windowId: number) => void;
  onCloseTab: (tabId: number) => void;
  onCollapse: () => void;
}

export function OpenTabsPanel({ groups, onSaveWindow, onCloseWindow, onCloseTab, onCollapse }: OpenTabsPanelProps) {
  return (
    <>
      <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}` }}>
        <strong style={{ letterSpacing: ".4px" }}>열린 탭</strong>
        <button type="button" title="패널 접기" aria-label="패널 접기" onClick={onCollapse} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
          <PanelRightClose size={16} color={theme.textFaint} />
        </button>
      </div>
      <div style={{ padding: "11px 13px", overflow: "auto" }}>
        {groups.map((g, i) => (
          <WindowGroupView key={g.windowId} group={g} index={i}
            onSaveWindow={onSaveWindow} onCloseWindow={onCloseWindow} onCloseTab={onCloseTab} />
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd apps/extension && pnpm exec vitest run src/newtab/OpenTabsPanel.test.tsx`
Expected: PASS — 기존 테스트 + 신규 테스트 모두 통과.

- [ ] **Step 5: 타입 체크**

Run: `cd apps/extension && pnpm lint`
Expected: 에러 없음 (exit 0).

- [ ] **Step 6: 커밋**

```bash
git add apps/extension/src/newtab/OpenTabsPanel.tsx apps/extension/src/newtab/OpenTabsPanel.test.tsx
git commit -m "[기능] 열린 탭 패널의 탭 sortable·창 droppable 전환"
```

---

### Task 4: NewTab — 탭→창 DnD 오케스트레이션 연결

`groups` 실시간 미리보기 + 드롭 시 `chrome.tabs.move`를 핸들러에 연결한다. 기존 컬렉션 저장 경로는 유지.

**Files:**
- Modify: `apps/extension/src/newtab/NewTab.tsx`

**Interfaces:**
- Consumes: `moveTab`, `resolveTabDropTarget`, `parseTabDragId` (tabs.ts, Task 1·2); 기존 `groupTabsByWindow`, `WindowGroup`, `WindowTab`, `arrayMove`, `findContainer`/`findContainerIn`, `NEW_TAB_PLACEHOLDER`, `linksByColRef`
- Produces: 탭을 창에 드롭하면 `chrome.tabs.move(tabId, { windowId, index })`로 실제 이동 후 `chrome.tabs.query`로 재조회. 컬렉션 드롭 시 기존 저장 동작 유지.

- [ ] **Step 1: import 보강**

`apps/extension/src/newtab/NewTab.tsx`의 tabs.ts import(line 22)를 다음으로 교체:

```ts
import { tabsToLinkInputs, tabDropToLinkInput, groupTabsByWindow, moveTab, resolveTabDropTarget, parseTabDragId, type WindowGroup, type WindowTab } from "../lib/tabs";
```

- [ ] **Step 2: groups용 ref 추가**

`dragOriginRef` 선언(line 58) 바로 아래에 추가:

```ts
  // 드래그 중 onDragEnd가 최신 groups를 읽도록 ref로 동기 보관.
  const groupsRef = useRef<WindowGroup[]>([]);
  // 드래그 시작 시점의 groups 스냅샷(탭이 컬렉션 위로 돌아오거나 취소될 때 원복용).
  const groupsOriginRef = useRef<WindowGroup[]>([]);
```

그리고 `groups` state 선언(`const [groups, setGroups] = useState<WindowGroup[]>([]);`, line 63) 바로 아래에 동기화 effect 추가:

```ts
  useEffect(() => { groupsRef.current = groups; }, [groups]);
```

- [ ] **Step 3: 충돌 감지에서 창 컨테이너를 컨테이너로 취급**

`collisionDetection`(lines 10-14)을 다음으로 교체:

```ts
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  // 카드(탭/링크) > 컨테이너(컬렉션 container:/창 window:) 순으로 우선.
  const cardHit = hits.find((h) => {
    const id = String(h.id);
    return !id.startsWith("container:") && !id.startsWith("window:");
  });
  return cardHit ? [cardHit] : hits;
};
```

- [ ] **Step 4: handleDragStart에서 groups 스냅샷 저장**

`handleDragStart`(lines 158-170)의 `else if (d?.kind === "tab")` 블록을 다음으로 교체:

```ts
    } else if (d?.kind === "tab") {
      dragOriginRef.current = null;
      groupsOriginRef.current = groups;
      setActive({ type: "tab", tab: d.tab as WindowTab });
```

- [ ] **Step 5: handleDragOver에 탭→창 분기 추가**

`handleDragOver`(line 173부터)에서, `const d = active.data.current;`(line 182) 줄을 `const overId` 계산 직후로 끌어올리고, **`const overC = findContainer(overId);` 줄 앞에** 탭→창 분기를 삽입한다. 구체적으로 lines 177-182 영역을 다음으로 교체:

```ts
    const activeId = String(active.id);
    const overId = String(over.id);
    const d = active.data.current;

    // 탭을 "열린 탭" 창 영역 위로 끌면 실제 창 간/내 재배치를 실시간 미리보기.
    if (d?.kind === "tab") {
      const winTarget = resolveTabDropTarget(groupsRef.current, overId);
      if (winTarget) {
        const tid = parseTabDragId(activeId);
        if (tid != null) {
          setGroups((prev) => {
            const next = moveTab(prev, tid, winTarget.toWindowId, winTarget.toIndex);
            groupsRef.current = next;
            return next;
          });
        }
        // 컬렉션에 남아있던 자리표시 카드 제거.
        setLinksByCol((prev) => {
          const cur = findContainerIn(prev, NEW_TAB_PLACEHOLDER);
          if (!cur) return prev;
          const next = { ...prev, [cur]: (prev[cur] ?? []).filter((l) => l.id !== NEW_TAB_PLACEHOLDER) };
          linksByColRef.current = next;
          return next;
        });
        setDragOverCol(null);
        return;
      }
      // 컬렉션 영역으로 돌아옴: 창 미리보기를 원본으로 원복하고 아래 컬렉션 로직으로 진행.
      setGroups(groupsOriginRef.current);
      groupsRef.current = groupsOriginRef.current;
    }

    const overC = findContainer(overId);
```

> 주의: 기존 lines 177-181의 `const overC = findContainer(overId); if (!overC) { setDragOverCol(null); return; } setDragOverCol(overC); const d = active.data.current;` 중 `const d`는 위에서 이미 선언했으므로 중복 선언을 제거하고, `setDragOverCol(overC)`는 그대로 유지한다. 교체 후 이어지는 라인이 다음과 같아야 한다:

```ts
    const overC = findContainer(overId);
    if (!overC) { setDragOverCol(null); return; }
    setDragOverCol(overC);

    setLinksByCol((prev) => {
```

(이후 기존 `setLinksByCol` 본문은 그대로 둔다.)

- [ ] **Step 6: handleDragEnd에 탭→창 이동 처리 추가**

`handleDragEnd`(line 248부터)를 수정한다.

(a) 초기 가드(line 254)를 다음으로 교체 — 탭이 빈 곳에 드롭되면 groups 원복:

```ts
    if (!over || !session) {
      if (d?.kind === "tab") { setGroups(groupsOriginRef.current); groupsRef.current = groupsOriginRef.current; }
      loadCollections();
      return;
    }
```

(b) `if (d?.kind === "tab") {` 블록(lines 258-268)을 다음으로 교체 — 창 드롭은 chrome.tabs.move, 컬렉션 드롭은 기존 저장:

```ts
    if (d?.kind === "tab") {
      // 1) 창에 드롭: 실제 브라우저 탭 이동
      const winTarget = resolveTabDropTarget(groupsRef.current, String(over.id));
      if (winTarget) {
        const tid = parseTabDragId(activeId);
        if (tid != null) {
          const g = groupsRef.current.find((x) => x.windowId === winTarget.toWindowId);
          const index = g ? g.tabs.findIndex((t) => t.id === tid) : -1;
          try { await chrome.tabs.move(tid, { windowId: winTarget.toWindowId, index }); } catch (e) { console.error(e); }
          const tabs = await chrome.tabs.query({});
          setGroups(groupTabsByWindow(tabs as WindowTab[]));
        }
        return;
      }
      // 2) 컬렉션에 드롭: 기존 저장 로직
      const overC = findContainerIn(map, NEW_TAB_PLACEHOLDER); // 자리표시 카드가 들어간 컬렉션
      if (!overC) { loadCollections(); return; }
      const items = map[overC] ?? [];
      const base = tabDropToLinkInput(d.tab as WindowTab, overC, session.user.id);
      if (!base) { loadCollections(); return; }
      const created = await createLink(supabase, base);
      const orderedIds = items.map((l) => (l.id === NEW_TAB_PLACEHOLDER ? created.id : l.id));
      setLinksByCol((prev) => ({ ...prev, [overC]: (prev[overC] ?? []).map((l) => (l.id === NEW_TAB_PLACEHOLDER ? { ...l, id: created.id } : l)) }));
      await persistOrder(orderedIds);
      reloadCollection(overC);
    } else if (d?.kind === "link") {
```

> 위 교체는 기존 `} else if (d?.kind === "link") {`까지 이어지도록 한다. link 분기 본문(lines 269-281)은 변경하지 않는다.

- [ ] **Step 7: handleDragCancel에서 탭 groups 원복**

`handleDragCancel`(lines 284-288)을 다음으로 교체:

```ts
  function handleDragCancel() {
    if (active?.type === "tab") { setGroups(groupsOriginRef.current); groupsRef.current = groupsOriginRef.current; }
    setActive(null);
    setDragOverCol(null);
    loadCollections();
  }
```

- [ ] **Step 8: 타입 체크 + 기존 테스트**

Run: `cd apps/extension && pnpm lint && pnpm exec vitest run`
Expected: 타입 에러 없음, 모든 단위 테스트 통과.

- [ ] **Step 9: 수동 검증 (브라우저)**

`chrome.tabs.move`는 실제 브라우저 동작이라 단위 테스트 대상이 아니다. 다음을 수동 확인:

1. `cd apps/extension && pnpm build` 후 `dist/`(또는 빌드 산출물)를 `chrome://extensions`에서 "압축해제된 확장 프로그램 로드"로 적재.
2. 창을 2개 이상 띄우고 새 탭(확장 newtab)을 연다.
3. "열린 탭" 패널에서 **같은 창 안에서** 탭을 위/아래로 드래그 → 순서가 바뀌고 실제 브라우저 탭 순서도 바뀐다.
4. **다른 창의 탭 사이/창 영역**으로 드래그 → 그 위치로 이동하고 실제 브라우저에서도 해당 창으로 이동한다.
5. chrome:// 탭(예: `chrome://extensions`)도 창 간 이동되는지 확인.
6. 탭을 **보드(컬렉션)** 로 드래그 → 기존대로 링크로 저장된다(회귀 없음).
7. 드래그를 ESC로 취소 → 패널이 원래 상태로 돌아온다.

Expected: 모든 항목 정상 동작.

- [ ] **Step 10: 커밋**

```bash
git add apps/extension/src/newtab/NewTab.tsx
git commit -m "[기능] 열린 탭 창 간 드래그 이동(chrome.tabs.move) 연결"
```

---

## Self-Review

**Spec coverage:**
- 창을 droppable 타깃으로 (`window:{windowId}`) → Task 3.
- 탭 `useSortable` 전환 → Task 3.
- `moveTab` 순수 함수 + 테스트 → Task 1.
- `groupsRef` / `groupsOriginRef` → Task 4 Step 2.
- handleDragStart 스냅샷 → Task 4 Step 4.
- handleDragOver 창/컬렉션 분기 + 자리표시 정리 + groups 원복 → Task 4 Step 5.
- handleDragEnd `chrome.tabs.move` + 재조회 → Task 4 Step 6.
- collisionDetection 보강 → Task 4 Step 3.
- 모든 탭 이동 허용(http 필터 없음) → `moveTab`/`resolveTabDropTarget`에 필터 없음(Task 1·2), Task 4가 그대로 사용.
- 이동 후 `chrome.tabs.query` 재조회 → Task 4 Step 6.
- 컬렉션 저장 동작 유지 → Task 4 Step 6 (2) 분기 보존.
- 테스트: `moveTab` 4+ 케이스(Task 1), `resolveTabDropTarget`(Task 2), OpenTabsPanel 렌더(Task 3).

**Placeholder scan:** 없음 — 모든 코드 단계에 실제 코드/명령/기대 결과 포함.

**Type consistency:** `moveTab(groups, tabId, toWindowId, toIndex)`, `resolveTabDropTarget(groups, overId): TabDropTarget | null`, `parseTabDragId(id): number | null`, drag id `tab-{id}`, window droppable id `window:{windowId}` — Task 1·2 정의와 Task 3·4 사용처가 일치함.
