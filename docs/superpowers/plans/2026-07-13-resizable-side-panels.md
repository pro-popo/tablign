# 사이드 패널 드래그 리사이즈 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 좌·우 사이드 패널의 안쪽 경계를 드래그해 `[180, 400]`px 범위에서 폭을 조절하고, 그 폭을 세션 간 기억한다.

**Architecture:** 기존 `usePanelState` 훅을 확장해 폭을 열림/닫힘과 같은 storage 키에 함께 저장한다. `AppShell`은 폭을 prop으로 받아 렌더하고 리사이즈 핸들의 포인터 드래그를 담당한다. `AppShell`은 `packages/ui`에 있어 `chrome.storage`에 직접 접근하지 않는다(플랫폼 어댑터 패턴 유지).

**Tech Stack:** React 18, TypeScript, Vitest + @testing-library/react, 인라인 스타일(별도 CSS 없음), Pointer Events API.

## Global Constraints

- 커밋 메시지: fe-toolkit 컨벤션 `[타입] 명사형` (예: `[기능] ...`). `feat(scope):` 금지.
- 폭 범위: `MIN_PANEL_WIDTH = 180`, `MAX_PANEL_WIDTH = 400`. 기본 폭: 좌 212, 우 272.
- 앱에 전역 border-box 리셋 없음 — 테두리 있는 요소는 `boxSizing: "border-box"` 명시.
- TDD: 각 유닛은 실패 테스트 → 최소 구현 → 통과 순서로.
- 테스트 실행 위치: `packages/ui`에서 `npm test`(vitest). 확장 타입체크: 루트에서 `npm run build`.

## File Structure

- `packages/ui/src/usePanelState.ts` (수정) — `PanelState`에 폭 추가, 클램프, 폭 setter, 복원 정규화.
- `packages/ui/src/__tests__/usePanelState.test.tsx` (수정) — 폭 관련 케이스 추가, 기존 기대값 갱신.
- `packages/ui/src/AppShell.tsx` (수정) — 폭 prop + 리사이즈 핸들 + 포인터 드래그.
- `packages/ui/src/__tests__/AppShell.test.tsx` (수정) — 핸들 렌더/드래그 테스트 추가.
- `apps/extension/src/newtab/NewTab.tsx` (수정) — 훅의 폭/세터를 AppShell에 연결.

`packages/ui/src/index.ts`는 이미 `usePanelState`, `AppShell`을 export하므로 변경 불필요(신규 상수/타입은 기존 `export * ` 또는 명시 export 경로를 따름 — Task 1에서 확인).

---

### Task 1: usePanelState 폭 상태 확장

**Files:**
- Modify: `packages/ui/src/usePanelState.ts`
- Test: `packages/ui/src/__tests__/usePanelState.test.tsx`

**Interfaces:**
- Consumes: 기존 `PanelStateStorage { read, write }`.
- Produces:
  - `interface PanelState { left: boolean; right: boolean; leftWidth: number; rightWidth: number }`
  - `export const MIN_PANEL_WIDTH = 180`, `export const MAX_PANEL_WIDTH = 400`
  - `usePanelState(storage)` 반환에 `setLeftWidth: (w: number) => void`, `setRightWidth: (w: number) => void` 추가
  - 기본 폭: `leftWidth: 212`, `rightWidth: 272`

- [ ] **Step 1: 기존 테스트를 새 형태로 갱신 + 폭 테스트 추가 (실패 유도)**

`packages/ui/src/__tests__/usePanelState.test.tsx` 전체를 아래로 교체:

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
  it("저장값이 없으면 기본값(둘 다 열림, 기본 폭)을 반환한다", () => {
    const { adapter } = fakeStorage(null);
    const { result } = renderHook(() => usePanelState(adapter));
    expect(result.current.state).toEqual({ left: true, right: true, leftWidth: 212, rightWidth: 272 });
  });

  it("저장된 상태를 초기에 읽어온다", () => {
    const { adapter } = fakeStorage({ left: false, right: true, leftWidth: 300, rightWidth: 350 });
    const { result } = renderHook(() => usePanelState(adapter));
    expect(result.current.state).toEqual({ left: false, right: true, leftWidth: 300, rightWidth: 350 });
  });

  it("폭 필드가 없던 기존 저장값은 기본 폭으로 보정한다(하위호환)", () => {
    const { adapter } = fakeStorage({ left: false, right: false } as PanelState);
    const { result } = renderHook(() => usePanelState(adapter));
    expect(result.current.state).toEqual({ left: false, right: false, leftWidth: 212, rightWidth: 272 });
  });

  it("복원 시 범위 밖 폭은 클램프한다", () => {
    const { adapter } = fakeStorage({ left: true, right: true, leftWidth: 50, rightWidth: 999 });
    const { result } = renderHook(() => usePanelState(adapter));
    expect(result.current.state.leftWidth).toBe(180);
    expect(result.current.state.rightWidth).toBe(400);
  });

  it("toggleLeft가 상태를 뒤집고 저장한다", () => {
    const { adapter, box } = fakeStorage(null);
    const { result } = renderHook(() => usePanelState(adapter));
    act(() => result.current.toggleLeft());
    expect(result.current.state).toEqual({ left: false, right: true, leftWidth: 212, rightWidth: 272 });
    expect(box.saved).toEqual({ left: false, right: true, leftWidth: 212, rightWidth: 272 });
  });

  it("setLeftWidth가 폭을 갱신·저장하고 범위를 클램프한다", () => {
    const { adapter, box } = fakeStorage(null);
    const { result } = renderHook(() => usePanelState(adapter));
    act(() => result.current.setLeftWidth(320));
    expect(result.current.state.leftWidth).toBe(320);
    expect(box.saved?.leftWidth).toBe(320);
    act(() => result.current.setLeftWidth(1000));
    expect(result.current.state.leftWidth).toBe(400);
    act(() => result.current.setLeftWidth(10));
    expect(result.current.state.leftWidth).toBe(180);
  });

  it("setRightWidth가 폭을 갱신·저장한다", () => {
    const { adapter, box } = fakeStorage(null);
    const { result } = renderHook(() => usePanelState(adapter));
    act(() => result.current.setRightWidth(360));
    expect(result.current.state.rightWidth).toBe(360);
    expect(box.saved?.rightWidth).toBe(360);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd packages/ui && npm test -- usePanelState`
Expected: FAIL — `setLeftWidth is not a function`, 기본값 불일치.

- [ ] **Step 3: 훅 구현**

`packages/ui/src/usePanelState.ts` 전체를 아래로 교체:

```ts
import { useEffect, useState } from "react";

export interface PanelState {
  left: boolean;
  right: boolean;
  leftWidth: number;
  rightWidth: number;
}

export const PANEL_STATE_KEY = "tablign.panels";
export const MIN_PANEL_WIDTH = 180;
export const MAX_PANEL_WIDTH = 400;
const DEFAULT: PanelState = { left: true, right: true, leftWidth: 212, rightWidth: 272 };

function clampWidth(w: number): number {
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, w));
}

// 하위호환: 폭 개념이 없던 기존 저장값도 유효로 본다(left/right만 필수).
export function isPanelState(v: unknown): v is PanelState {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as PanelState).left === "boolean" &&
    typeof (v as PanelState).right === "boolean"
  );
}

// 저장값을 완전한 PanelState로 정규화. 폭이 없거나 숫자가 아니면 기본값, 있으면 클램프.
function normalize(v: PanelState): PanelState {
  return {
    left: v.left,
    right: v.right,
    leftWidth: typeof v.leftWidth === "number" ? clampWidth(v.leftWidth) : DEFAULT.leftWidth,
    rightWidth: typeof v.rightWidth === "number" ? clampWidth(v.rightWidth) : DEFAULT.rightWidth,
  };
}

/** 플랫폼별 영속화(localStorage / chrome.storage)를 주입하는 어댑터. read는 비동기(콜백) 허용. */
export interface PanelStateStorage {
  read: (cb: (state: PanelState | null) => void) => void;
  write: (state: PanelState) => void;
}

export function usePanelState(storage: PanelStateStorage) {
  const [state, setState] = useState<PanelState>(DEFAULT);

  useEffect(() => {
    storage.read((s) => { if (s) setState(normalize(s)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(key: "left" | "right") {
    setState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      storage.write(next);
      return next;
    });
  }

  function setWidth(key: "leftWidth" | "rightWidth", value: number) {
    setState((prev) => {
      const next = { ...prev, [key]: clampWidth(value) };
      storage.write(next);
      return next;
    });
  }

  return {
    state,
    toggleLeft: () => toggle("left"),
    toggleRight: () => toggle("right"),
    setLeftWidth: (w: number) => setWidth("leftWidth", w),
    setRightWidth: (w: number) => setWidth("rightWidth", w),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd packages/ui && npm test -- usePanelState`
Expected: PASS (7 tests).

- [ ] **Step 5: 커밋**

```bash
git add packages/ui/src/usePanelState.ts packages/ui/src/__tests__/usePanelState.test.tsx
git commit -m "[기능] 패널 폭 상태·영속화 확장"
```

---

### Task 2: AppShell 리사이즈 핸들·드래그

**Files:**
- Modify: `packages/ui/src/AppShell.tsx`
- Test: `packages/ui/src/__tests__/AppShell.test.tsx`

**Interfaces:**
- Consumes: `theme.accent` (`#3b5bdb`), `theme.border`, `theme.surface`.
- Produces: `AppShellProps`에 선택적 prop 추가 — `leftWidth?: number`, `rightWidth?: number`, `onResizeLeft?: (w: number) => void`, `onResizeRight?: (w: number) => void`. 리사이즈 핸들은 `role="separator"`, `aria-label`은 `"왼쪽 패널 크기 조절"` / `"오른쪽 패널 크기 조절"`.

- [ ] **Step 1: 핸들 렌더·드래그 테스트 추가 (실패 유도)**

`packages/ui/src/__tests__/AppShell.test.tsx` 끝의 마지막 `it(...)` 다음(닫는 `});` 앞)에 아래 두 테스트를 추가:

```tsx
  it("패널이 열리면 리사이즈 핸들이 보이고 닫히면 사라진다", () => {
    const { rerender } = render(
      <AppShell
        leftOpen rightOpen
        onToggleLeft={() => {}} onToggleRight={() => {}}
        left={<div>LEFT</div>} right={<div>RIGHT</div>}
      >
        <div>CENTER</div>
      </AppShell>,
    );
    expect(screen.getByRole("separator", { name: "왼쪽 패널 크기 조절" })).toBeInTheDocument();

    rerender(
      <AppShell
        leftOpen={false} rightOpen
        onToggleLeft={() => {}} onToggleRight={() => {}}
        left={<div>LEFT</div>} right={<div>RIGHT</div>}
      >
        <div>CENTER</div>
      </AppShell>,
    );
    expect(screen.queryByRole("separator", { name: "왼쪽 패널 크기 조절" })).not.toBeInTheDocument();
  });

  it("left 핸들 드래그가 onResizeLeft를 시작폭+delta로 호출한다", () => {
    const onResizeLeft = vi.fn();
    render(
      <AppShell
        leftOpen rightOpen
        onToggleLeft={() => {}} onToggleRight={() => {}}
        left={<div>LEFT</div>} right={<div>RIGHT</div>}
        leftWidth={212} onResizeLeft={onResizeLeft}
      >
        <div>CENTER</div>
      </AppShell>,
    );
    const handle = screen.getByRole("separator", { name: "왼쪽 패널 크기 조절" });
    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 130, pointerId: 1 });
    expect(onResizeLeft).toHaveBeenCalledWith(242);
  });

  it("right 핸들 드래그는 왼쪽으로 끌면 폭이 늘어난다", () => {
    const onResizeRight = vi.fn();
    render(
      <AppShell
        leftOpen rightOpen
        onToggleLeft={() => {}} onToggleRight={() => {}}
        left={<div>LEFT</div>} right={<div>RIGHT</div>}
        rightWidth={272} onResizeRight={onResizeRight}
      >
        <div>CENTER</div>
      </AppShell>,
    );
    const handle = screen.getByRole("separator", { name: "오른쪽 패널 크기 조절" });
    fireEvent.pointerDown(handle, { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 170, pointerId: 1 });
    expect(onResizeRight).toHaveBeenCalledWith(302);
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd packages/ui && npm test -- AppShell`
Expected: FAIL — `role="separator"` 요소 없음.

- [ ] **Step 3: AppShell 구현**

`packages/ui/src/AppShell.tsx` 전체를 아래로 교체:

```tsx
import { useRef, useState, type ReactNode } from "react";
import { PanelLeftOpen, PanelRightOpen } from "./icons";
import { theme } from "./theme";

export interface AppShellProps {
  left: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  leftWidth?: number;
  rightWidth?: number;
  onResizeLeft?: (w: number) => void;
  onResizeRight?: (w: number) => void;
}

const RAIL = 44;
const DEFAULT_LEFT_WIDTH = 212;
const DEFAULT_RIGHT_WIDTH = 272;

function Rail({ onClick, label, icon }: { onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 10 }}>
      <button type="button" title={label} aria-label={label} onClick={onClick}
        style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 4, height: "fit-content" }}>
        {icon}
      </button>
    </div>
  );
}

/** 패널 안쪽 경계의 리사이즈 핸들. 평소 투명, 호버 시 accent 라인. */
function ResizeHandle({
  side, width, onStart, onMove, onEnd,
}: {
  side: "left" | "right";
  width: number;
  onStart: (e: React.PointerEvent, width: number) => void;
  onMove: (e: React.PointerEvent, side: "left" | "right") => void;
  onEnd: (e: React.PointerEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === "left" ? "왼쪽 패널 크기 조절" : "오른쪽 패널 크기 조절"}
      onPointerDown={(e) => onStart(e, width)}
      onPointerMove={(e) => onMove(e, side)}
      onPointerUp={onEnd}
      onLostPointerCapture={onEnd}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        boxSizing: "border-box",
        position: "absolute", top: 0, bottom: 0,
        [side === "left" ? "right" : "left"]: 0,
        width: 6, cursor: "col-resize", zIndex: 5,
        [side === "left" ? "borderRight" : "borderLeft"]: `2px solid ${hover ? theme.accent : "transparent"}`,
      }}
    />
  );
}

export function AppShell({
  left, right, children, leftOpen, rightOpen, onToggleLeft, onToggleRight,
  leftWidth = DEFAULT_LEFT_WIDTH, rightWidth = DEFAULT_RIGHT_WIDTH, onResizeLeft, onResizeRight,
}: AppShellProps) {
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  function startDrag(e: React.PointerEvent, width: number) {
    // jsdom 등 환경에서 setPointerCapture 미구현일 수 있어 방어.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    dragRef.current = { startX: e.clientX, startWidth: width };
    setDragging(true);
  }
  function moveDrag(e: React.PointerEvent, side: "left" | "right") {
    if (!dragRef.current) return;
    const delta = e.clientX - dragRef.current.startX;
    const next = side === "left" ? dragRef.current.startWidth + delta : dragRef.current.startWidth - delta;
    (side === "left" ? onResizeLeft : onResizeRight)?.(next);
  }
  function endDrag(e: React.PointerEvent) {
    dragRef.current = null;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }

  const panel = (side: "left" | "right", open: boolean, openWidth: number): React.CSSProperties => ({
    width: open ? openWidth : RAIL,
    flexShrink: 0,
    // 드래그 중에는 폭 애니메이션을 꺼 랙을 없앤다(열기/닫기 때만 부드럽게).
    transition: dragging ? "none" : "width 0.2s ease",
    overflow: "hidden",
    background: theme.surface,
    [side === "left" ? "borderRight" : "borderLeft"]: `1px solid ${theme.border}`,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  });

  return (
    <div style={{ display: "flex", height: "100vh", background: theme.bg, color: theme.text, fontFamily: "-apple-system, system-ui, sans-serif", fontSize: 13 }}>
      <aside style={panel("left", leftOpen, leftWidth)}>
        {leftOpen ? left : <Rail onClick={onToggleLeft} label="사이드바 열기" icon={<PanelLeftOpen size={18} color={theme.textFaint} />} />}
        {leftOpen && <ResizeHandle side="left" width={leftWidth} onStart={startDrag} onMove={moveDrag} onEnd={endDrag} />}
      </aside>
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </main>
      {right && (
        <aside style={panel("right", rightOpen, rightWidth)}>
          {rightOpen ? right : <Rail onClick={onToggleRight} label="열린 탭 열기" icon={<PanelRightOpen size={18} color={theme.textFaint} />} />}
          {rightOpen && <ResizeHandle side="right" width={rightWidth} onStart={startDrag} onMove={moveDrag} onEnd={endDrag} />}
        </aside>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd packages/ui && npm test -- AppShell`
Expected: PASS (기존 2 + 신규 3 = 5 tests).

- [ ] **Step 5: 커밋**

```bash
git add packages/ui/src/AppShell.tsx packages/ui/src/__tests__/AppShell.test.tsx
git commit -m "[기능] AppShell 패널 리사이즈 핸들"
```

---

### Task 3: NewTab에서 폭 연결

**Files:**
- Modify: `apps/extension/src/newtab/NewTab.tsx`

**Interfaces:**
- Consumes: Task 1의 `usePanelState()` 반환 `state.leftWidth`, `state.rightWidth`, `setLeftWidth`, `setRightWidth`; Task 2의 AppShell 폭 prop.
- Produces: 없음(최종 배선).

- [ ] **Step 1: 훅 구조분해에 세터 추가**

`apps/extension/src/newtab/NewTab.tsx`에서 다음 줄을 찾는다:

```tsx
  const { state: panels, toggleLeft, toggleRight } = usePanelState();
```

아래로 바꾼다:

```tsx
  const { state: panels, toggleLeft, toggleRight, setLeftWidth, setRightWidth } = usePanelState();
```

- [ ] **Step 2: AppShell에 폭 prop 전달**

같은 파일에서 다음 블록을 찾는다:

```tsx
      <AppShell
        leftOpen={panels.left}
        rightOpen={panels.right}
        onToggleLeft={toggleLeft}
        onToggleRight={toggleRight}
```

아래로 바꾼다:

```tsx
      <AppShell
        leftOpen={panels.left}
        rightOpen={panels.right}
        onToggleLeft={toggleLeft}
        onToggleRight={toggleRight}
        leftWidth={panels.leftWidth}
        rightWidth={panels.rightWidth}
        onResizeLeft={setLeftWidth}
        onResizeRight={setRightWidth}
```

- [ ] **Step 3: 타입체크 + 빌드**

Run: `npm run build`
Expected: 에러 없이 빌드 완료(`apps/extension build: Done`).

- [ ] **Step 4: 전체 UI 패키지 테스트**

Run: `cd packages/ui && npm test`
Expected: 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add apps/extension/src/newtab/NewTab.tsx
git commit -m "[기능] 사이드 패널 폭 조절 연결"
```

---

## Self-Review

**Spec coverage:**
- 좌·우 드래그 리사이즈 → Task 2(핸들·드래그) + Task 3(연결). ✅
- 범위 `[180,400]`, 기본 212/272 → Task 1(clampWidth, DEFAULT). ✅
- 세션 간 기억 → Task 1(setWidth가 storage.write). ✅
- 호버 강조 핸들 → Task 2(ResizeHandle hover→accent). ✅
- 열림 시에만 리사이즈 → Task 2(`leftOpen && <ResizeHandle>`). ✅
- 하위호환(폭 없는 기존 값) → Task 1(normalize + isPanelState). ✅

**Placeholder scan:** 모든 코드 스텝에 실제 코드/명령/기대 출력 포함. 플레이스홀더 없음. ✅

**Type consistency:** `setLeftWidth`/`setRightWidth`(Task1) = NewTab 구조분해(Task3) = AppShell `onResizeLeft`/`onResizeRight`에 전달되는 함수 시그니처 `(w: number) => void` 일치. `MIN_PANEL_WIDTH`/`MAX_PANEL_WIDTH` 상수명 일관. `role="separator"` + aria-label 문자열이 Task2 테스트/구현에서 동일. ✅
</content>
