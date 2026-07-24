# 조직 프로필 색상 그라데이션 지원 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 조직(팀·개인) 프로필의 대표 색을 단색뿐 아니라 135° 그라데이션으로도 지정할 수 있게 하고, 커스텀 색처럼 직접 조정(두 색·비율)하는 통합 편집기를 제공한다.

**Architecture:** `organizations.color`(자유 문자열)에 단색 `#RRGGBB` 또는 `linear-gradient(135deg,#A p%,#B q%)`를 저장한다. 렌더 지점(레일·헤더·다이얼로그 미리보기)은 이미 그 문자열을 CSS `background`로 그대로 쓰므로 스키마·렌더 변경이 거의 없다. 파싱/빌드 순수함수를 `@tablign/ui`에 두고, 그 위에 `ColorGradientPicker`(토글·사각 미리보기·인셋 핸들 바·팔레트 팝오버) 컴포넌트를 만들어 `OrgFormDialog`의 커스텀 색 슬롯 팝오버를 교체한다.

**Tech Stack:** React 18 + TypeScript, Vitest + @testing-library/react, pnpm 워크스페이스(`@tablign/ui`, `@tablign/extension`), 기존 `ColorPicker`/`color.ts`.

## Global Constraints

- 그라데이션 각도는 **항상 135°** 고정. (방사형·다중 각도·3색+ 스톱은 범위 밖)
- 저장 문자열: 단색 `#RRGGBB`(대문자, `normalizeHex` 형식) · 그라데이션 `linear-gradient(135deg, #START p%, #END q%)`. 비율이 균등(0%/100%)이면 퍼센트 생략(`linear-gradient(135deg, #START, #END)`). 시작 색 == 끝 색이면 단색 hex로 정규화.
- HEX 텍스트는 팔레트(ColorPicker) 안에서만 노출. 핸들/미리보기엔 색만.
- 커밋 메시지는 저장소 컨벤션 `[타입] 명사형` 사용(예: `[기능] 조직 색상 그라데이션 편집기`). `feat(scope):` 금지.
- 기존 단색 hex 값은 그대로 단색으로 로드(하위호환). DB 스키마 변경 없음.
- 편집기·팔레트는 라이트 테마 기준(기존 다이얼로그와 동일), `theme` 토큰 사용.

---

## File Structure

- `packages/ui/src/colorValue.ts` — **신규**. 색 문자열 파싱/빌드 순수함수(`parseColorValue`, `buildColorValue`, 타입). `color.ts`의 `normalizeHex` 재사용.
- `packages/ui/src/__tests__/colorValue.test.ts` — **신규**. 위 순수함수 단위테스트.
- `packages/ui/src/ColorGradientPicker.tsx` — **신규**. 편집기 컴포넌트(토글·사각 미리보기·인셋 핸들 바·스왑·핸들 팔레트 팝오버). 내부 팔레트는 기존 `ColorPicker` 재사용.
- `packages/ui/src/__tests__/ColorGradientPicker.test.tsx` — **신규**. 컴포넌트 상호작용 테스트.
- `packages/ui/src/index.ts` — **수정**. `colorValue`·`ColorGradientPicker` export 추가(25행 부근 export 목록).
- `apps/extension/src/newtab/OrgFormDialog.tsx` — **수정**. 색상 커스텀 슬롯 팝오버(291–299행 부근 `<ColorPicker>`)를 `<ColorGradientPicker>`로 교체.
- `apps/extension/src/newtab/NewTab.test.tsx` — **수정**. 그라데이션 저장 경로 테스트 1건 추가.

렌더 지점(`OrgRail.tsx`·`OrgHeader.tsx`)은 이미 `background: <color 문자열>`을 쓰므로 코드 변경 없음 — Task 4에서 스냅샷성 검증 테스트만 추가한다.

---

### Task 1: 색 문자열 파싱/빌드 순수함수

색 저장 문자열을 편집기 상태로 파싱하고, 편집기 상태를 저장 문자열로 빌드하는 순수함수. UI 컴포넌트가 이것만 의존하도록 먼저 만든다.

**Files:**
- Create: `packages/ui/src/colorValue.ts`
- Test: `packages/ui/src/__tests__/colorValue.test.ts`
- Modify: `packages/ui/src/index.ts` (export 추가)

**Interfaces:**
- Consumes: `normalizeHex` from `packages/ui/src/color.ts`.
- Produces:
  - `type ColorValue = { kind: "solid"; hex: string } | { kind: "gradient"; start: string; end: string; startPos: number; endPos: number }`
  - `parseColorValue(value: string | null | undefined): ColorValue` — 항상 유효한 값 반환(불량/누락 입력은 기본 단색 `#748FFC`).
  - `buildColorValue(v: ColorValue): string` — 저장 문자열. gradient에서 `start===end`면 단색 hex로 정규화; `startPos===0 && endPos===100`이면 퍼센트 생략.
  - `DEFAULT_COLOR_VALUE: ColorValue` (= `{ kind: "solid", hex: "#748FFC" }`).

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/__tests__/colorValue.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseColorValue, buildColorValue, DEFAULT_COLOR_VALUE } from "../colorValue";

describe("parseColorValue", () => {
  it("단색 hex", () => {
    expect(parseColorValue("#748FFC")).toEqual({ kind: "solid", hex: "#748FFC" });
  });
  it("3자리 hex도 정규화", () => {
    expect(parseColorValue("#abc")).toEqual({ kind: "solid", hex: "#AABBCC" });
  });
  it("퍼센트 없는 그라데이션은 0/100", () => {
    expect(parseColorValue("linear-gradient(135deg, #748FFC, #9775FA)")).toEqual({
      kind: "gradient", start: "#748FFC", end: "#9775FA", startPos: 0, endPos: 100,
    });
  });
  it("퍼센트 있는 그라데이션", () => {
    expect(parseColorValue("linear-gradient(135deg, #748FFC 55%, #9775FA 100%)")).toEqual({
      kind: "gradient", start: "#748FFC", end: "#9775FA", startPos: 55, endPos: 100,
    });
  });
  it("null·불량 입력은 기본 단색", () => {
    expect(parseColorValue(null)).toEqual(DEFAULT_COLOR_VALUE);
    expect(parseColorValue("garbage")).toEqual(DEFAULT_COLOR_VALUE);
  });
});

describe("buildColorValue", () => {
  it("단색", () => {
    expect(buildColorValue({ kind: "solid", hex: "#748FFC" })).toBe("#748FFC");
  });
  it("균등 그라데이션은 퍼센트 생략", () => {
    expect(buildColorValue({ kind: "gradient", start: "#748FFC", end: "#9775FA", startPos: 0, endPos: 100 }))
      .toBe("linear-gradient(135deg, #748FFC, #9775FA)");
  });
  it("비율 그라데이션은 퍼센트 포함", () => {
    expect(buildColorValue({ kind: "gradient", start: "#748FFC", end: "#9775FA", startPos: 55, endPos: 100 }))
      .toBe("linear-gradient(135deg, #748FFC 55%, #9775FA 100%)");
  });
  it("시작=끝 그라데이션은 단색으로 정규화", () => {
    expect(buildColorValue({ kind: "gradient", start: "#748FFC", end: "#748FFC", startPos: 0, endPos: 100 }))
      .toBe("#748FFC");
  });
  it("parse→build 왕복", () => {
    const s = "linear-gradient(135deg, #748FFC 30%, #9775FA 80%)";
    expect(buildColorValue(parseColorValue(s))).toBe(s);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tablign/ui test -- colorValue`
Expected: FAIL — `Cannot find module '../colorValue'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/ui/src/colorValue.ts`:

```ts
import { normalizeHex } from "./color";

export type ColorValue =
  | { kind: "solid"; hex: string }
  | { kind: "gradient"; start: string; end: string; startPos: number; endPos: number };

export const DEFAULT_COLOR_VALUE: ColorValue = { kind: "solid", hex: "#748FFC" };

// linear-gradient(135deg, #AAA[ p%], #BBB[ q%]) 형태만 인식한다(각도 135° 고정 가정).
const GRAD_RE = /^linear-gradient\(\s*135deg\s*,\s*(#[0-9a-fA-F]{3,6})(?:\s+(\d{1,3})%)?\s*,\s*(#[0-9a-fA-F]{3,6})(?:\s+(\d{1,3})%)?\s*\)$/;

export function parseColorValue(value: string | null | undefined): ColorValue {
  if (!value) return DEFAULT_COLOR_VALUE;
  const trimmed = value.trim();
  const g = trimmed.match(GRAD_RE);
  if (g) {
    const start = normalizeHex(g[1]);
    const end = normalizeHex(g[3]);
    if (start && end) {
      const startPos = g[2] !== undefined ? clampPct(Number(g[2])) : 0;
      const endPos = g[4] !== undefined ? clampPct(Number(g[4])) : 100;
      return { kind: "gradient", start, end, startPos, endPos };
    }
  }
  const hex = normalizeHex(trimmed);
  if (hex) return { kind: "solid", hex };
  return DEFAULT_COLOR_VALUE;
}

export function buildColorValue(v: ColorValue): string {
  if (v.kind === "solid") return v.hex;
  if (v.start === v.end) return v.start; // 시작=끝이면 단색
  const s = v.startPos === 0 ? v.start : `${v.start} ${v.startPos}%`;
  const e = v.endPos === 100 ? v.end : `${v.end} ${v.endPos}%`;
  return `linear-gradient(135deg, ${s}, ${e})`;
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tablign/ui test -- colorValue`
Expected: PASS (11 assertions).

- [ ] **Step 5: Add exports**

In `packages/ui/src/index.ts`, after the line `export * from "./color";` add:

```ts
export * from "./colorValue";
```

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @tablign/ui lint`
Expected: no output (pass).

```bash
git add packages/ui/src/colorValue.ts packages/ui/src/__tests__/colorValue.test.ts packages/ui/src/index.ts
git commit -m "[기능] 조직 색상 문자열 파싱·빌드 유틸(단색·135° 그라데이션)"
```

---

### Task 2: ColorGradientPicker 컴포넌트 — 단색/그라데이션 토글 + 미리보기 + 팔레트

편집기 골격. 상단 토글, 사각 미리보기, 색 핸들(탭 시 팔레트 팝오버). 비율 드래그는 Task 3에서 추가한다(이 태스크는 균등 비율 고정).

**Files:**
- Create: `packages/ui/src/ColorGradientPicker.tsx`
- Test: `packages/ui/src/__tests__/ColorGradientPicker.test.tsx`
- Modify: `packages/ui/src/index.ts` (export 추가)

**Interfaces:**
- Consumes: `ColorValue`/`parseColorValue`/`buildColorValue`/`DEFAULT_COLOR_VALUE` (Task 1), `ColorPicker` from `./ColorPicker`, `theme` from `./theme`.
- Produces:
  - `interface ColorGradientPickerProps { value: string; onChange: (value: string) => void; previewIcon?: string }`
  - `export function ColorGradientPicker(props): JSX.Element`
  - 접근성 라벨(테스트 앵커): 토글 버튼 `aria-label="단색"` / `aria-label="그라데이션"`; 핸들 버튼 `aria-label="색"`(단색) · `aria-label="시작 색"` · `aria-label="끝 색"`; 스왑 버튼 `aria-label="시작 끝 색 교환"`.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/__tests__/ColorGradientPicker.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorGradientPicker } from "../ColorGradientPicker";

describe("ColorGradientPicker", () => {
  it("단색 값이면 색 핸들 하나, 그라데이션 토글 있음", () => {
    render(<ColorGradientPicker value="#748FFC" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "색" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "그라데이션" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "시작 색" })).not.toBeInTheDocument();
  });

  it("그라데이션으로 토글하면 시작·끝 핸들이 나오고 onChange가 그라데이션 문자열을 emit", () => {
    const onChange = vi.fn();
    render(<ColorGradientPicker value="#748FFC" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "그라데이션" }));
    expect(screen.getByRole("button", { name: "시작 색" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "끝 색" })).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^linear-gradient\(135deg,/));
  });

  it("핸들 탭하면 팔레트(HEX 입력) 팝오버가 열린다", () => {
    render(<ColorGradientPicker value="#748FFC" onChange={() => {}} />);
    expect(screen.queryByDisplayValue("#748FFC")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "색" }));
    expect(screen.getByDisplayValue("#748FFC")).toBeInTheDocument();
  });

  it("그라데이션에서 끝 색을 바꾸면 그 색이 emit된다", () => {
    const onChange = vi.fn();
    render(<ColorGradientPicker value="linear-gradient(135deg, #748FFC, #9775FA)" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "끝 색" }));
    const hexInput = screen.getByDisplayValue("#9775FA");
    fireEvent.change(hexInput, { target: { value: "#FF0000" } });
    expect(onChange).toHaveBeenCalledWith("linear-gradient(135deg, #748FFC, #FF0000)");
  });

  it("스왑 버튼이 시작·끝 색을 맞바꾼다", () => {
    const onChange = vi.fn();
    render(<ColorGradientPicker value="linear-gradient(135deg, #748FFC, #9775FA)" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "시작 끝 색 교환" }));
    expect(onChange).toHaveBeenCalledWith("linear-gradient(135deg, #9775FA, #748FFC)");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tablign/ui test -- ColorGradientPicker`
Expected: FAIL — `Cannot find module '../ColorGradientPicker'`.

- [ ] **Step 3: Write the component**

Create `packages/ui/src/ColorGradientPicker.tsx`:

```tsx
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { theme } from "./theme";
import { ColorPicker } from "./ColorPicker";
import { parseColorValue, buildColorValue, type ColorValue } from "./colorValue";

export interface ColorGradientPickerProps {
  value: string;
  onChange: (value: string) => void;
  previewIcon?: string;
}

type ActiveStop = "start" | "end" | null;

// 시작 색에서 살짝 변형한 기본 끝 색 — 단색→그라데이션 전환 시 사용.
function deriveEndColor(hex: string): string {
  // 마지막 바이트를 회전시켜 시각적으로 구분되는 색을 만든다(단순·결정적).
  const n = parseInt(hex.slice(1), 16);
  const rotated = (n ^ 0x2233aa) & 0xffffff;
  return "#" + rotated.toString(16).padStart(6, "0").toUpperCase();
}

export function ColorGradientPicker({ value, onChange, previewIcon }: ColorGradientPickerProps) {
  const parsed = parseColorValue(value);
  const [active, setActive] = useState<ActiveStop>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setActive(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setActive(null); }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [active]);

  const isGradient = parsed.kind === "gradient";
  const preview = buildColorValue(parsed);

  function emit(next: ColorValue) { onChange(buildColorValue(next)); }

  function setMode(gradient: boolean) {
    if (gradient && parsed.kind === "solid") {
      emit({ kind: "gradient", start: parsed.hex, end: deriveEndColor(parsed.hex), startPos: 0, endPos: 100 });
    } else if (!gradient && parsed.kind === "gradient") {
      emit({ kind: "solid", hex: parsed.start });
      setActive(null);
    }
  }

  function currentStopHex(): string {
    if (parsed.kind === "solid") return parsed.hex;
    return active === "end" ? parsed.end : parsed.start;
  }

  function setStopHex(hex: string) {
    if (parsed.kind === "solid") { emit({ kind: "solid", hex }); return; }
    if (active === "end") emit({ ...parsed, end: hex });
    else emit({ ...parsed, start: hex });
  }

  function swap() {
    if (parsed.kind !== "gradient") return;
    emit({ ...parsed, start: parsed.end, end: parsed.start });
  }

  const seg = (on: boolean): CSSProperties => ({
    flex: 1, textAlign: "center", padding: "6px 0", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
    border: "none", background: on ? theme.accent : "transparent", color: on ? "#fff" : theme.textMuted,
  });
  const handleStyle = (bg: string, isActive: boolean, left: string): CSSProperties => ({
    position: "absolute", top: "50%", left, transform: "translate(-50%,-50%)", width: 24, height: 24, borderRadius: "50%",
    border: "3px solid #fff", background: bg, cursor: "pointer", padding: 0, boxSizing: "border-box",
    boxShadow: isActive ? `0 0 0 2px ${theme.accent}, 0 2px 5px rgba(0,0,0,.25)` : "0 0 0 1px rgba(0,0,0,.18), 0 2px 5px rgba(0,0,0,.25)",
  });

  return (
    <div ref={wrapRef} style={{ position: "relative", width: 224, boxSizing: "border-box" }}>
      {/* 토글 */}
      <div style={{ display: "flex", border: `1px solid ${theme.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
        <button type="button" aria-label="단색" aria-pressed={!isGradient} style={seg(!isGradient)} onClick={() => setMode(false)}>단색</button>
        <button type="button" aria-label="그라데이션" aria-pressed={isGradient} style={seg(isGradient)} onClick={() => setMode(true)}>그라데이션</button>
      </div>

      {/* 사각 미리보기 */}
      <div style={{ width: 46, height: 46, borderRadius: 12, margin: "0 auto 12px", background: preview,
        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 26, boxSizing: "border-box" }}>
        {previewIcon ?? ""}
      </div>

      {/* 바 + 인셋 핸들 */}
      <div style={{ position: "relative", height: 34, borderRadius: 9, background: isGradient
          ? `linear-gradient(90deg, ${parsed.start} ${parsed.startPos}%, ${parsed.end} ${parsed.endPos}%)`
          : (parsed.kind === "solid" ? parsed.hex : ""),
        boxShadow: "0 0 0 1px rgba(0,0,0,.06)" }}>
        {parsed.kind === "solid" ? (
          <button type="button" aria-label="색" style={handleStyle(parsed.hex, active === "start", "50%")}
            onClick={() => setActive(active ? null : "start")} />
        ) : (
          <>
            <button type="button" aria-label="시작 색" style={handleStyle(parsed.start, active === "start", "16px")}
              onClick={() => setActive(active === "start" ? null : "start")} />
            <button type="button" aria-label="끝 색" style={handleStyle(parsed.end, active === "end", "calc(100% - 16px)")}
              onClick={() => setActive(active === "end" ? null : "end")} />
          </>
        )}
      </div>

      {/* 스왑(그라데이션만) */}
      {isGradient && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
          <button type="button" aria-label="시작 끝 색 교환" onClick={swap}
            style={{ border: `1px solid ${theme.border}`, background: "#fff", borderRadius: 8, padding: "4px 10px",
              fontSize: 11, color: theme.textMuted, cursor: "pointer" }}>↔ 시작·끝 교환</button>
        </div>
      )}

      {/* 팔레트 팝오버 */}
      {active && (
        <div onClick={(e) => e.stopPropagation()}
          style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8, zIndex: 5,
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12,
            boxShadow: "0 16px 38px rgba(0,0,0,.18)", boxSizing: "border-box" }}>
          <ColorPicker value={currentStopHex()} onChange={setStopHex} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tablign/ui test -- ColorGradientPicker`
Expected: PASS (5 tests).

Note: `deriveEndColor("#748FFC")` = `#56BC56` (결정적). "그라데이션 토글 시 문자열 emit" 테스트는 정규식(`/^linear-gradient\(135deg,/`)으로만 검증하므로 정확한 끝 색과 무관하게 통과한다.

- [ ] **Step 5: Add export**

In `packages/ui/src/index.ts`, after `export * from "./ColorPicker";` add:

```ts
export * from "./ColorGradientPicker";
```

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @tablign/ui lint`
Expected: no output.

```bash
git add packages/ui/src/ColorGradientPicker.tsx packages/ui/src/__tests__/ColorGradientPicker.test.tsx packages/ui/src/index.ts
git commit -m "[기능] 색상 그라데이션 편집기 컴포넌트(토글·미리보기·팔레트 팝오버)"
```

---

### Task 3: 인셋 핸들 비율(스톱 위치) 드래그 조정

그라데이션 핸들을 바 안쪽에서 좌우로 드래그해 스톱 위치(=영역 비율)를 조정한다. 탭(색 팝오버)과 드래그(위치)를 이동 임계값으로 구분하고, 두 핸들이 겹치지 않게 최소 간격을 둔다.

**Files:**
- Modify: `packages/ui/src/ColorGradientPicker.tsx`
- Test: `packages/ui/src/__tests__/ColorGradientPicker.test.tsx` (테스트 추가)

**Interfaces:**
- Consumes: Task 2의 `ColorGradientPicker` 내부 상태·`emit`.
- Produces: 외부 인터페이스 변화 없음. 드래그 시 `onChange`가 `startPos`/`endPos`가 반영된 문자열을 emit. 상수 `MIN_GAP = 10`(퍼센트) — 두 스톱 최소 간격.

- [ ] **Step 1: Write the failing test**

Add to `packages/ui/src/__tests__/ColorGradientPicker.test.tsx` (describe 블록 안):

```tsx
it("끝 핸들을 왼쪽으로 드래그하면 endPos가 줄어든 문자열을 emit", () => {
  const onChange = vi.fn();
  render(<ColorGradientPicker value="linear-gradient(135deg, #748FFC, #9775FA)" onChange={onChange} />);
  const bar = screen.getByTestId("gradient-bar");
  // jsdom은 레이아웃이 0이므로 getBoundingClientRect를 200px 폭으로 스텁한다.
  bar.getBoundingClientRect = () => ({ left: 0, right: 200, width: 200, top: 0, bottom: 34, height: 34, x: 0, y: 0, toJSON: () => {} });
  const endHandle = screen.getByRole("button", { name: "끝 색" });
  fireEvent.pointerDown(endHandle, { clientX: 184 });
  fireEvent.pointerMove(window, { clientX: 100, buttons: 1 }); // 중앙(=50%) 근처로 이동
  fireEvent.pointerUp(window, { clientX: 100 });
  const last = onChange.mock.calls.at(-1)![0] as string;
  expect(last).toMatch(/#9775FA 5\d%\)$/); // endPos ≈ 50%
  // 드래그였으므로 팔레트는 열리지 않음
  expect(screen.queryByDisplayValue("#9775FA")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tablign/ui test -- ColorGradientPicker`
Expected: FAIL — `getByTestId("gradient-bar")` 없음(그리고 드래그 로직 부재).

- [ ] **Step 3: Implement drag**

In `packages/ui/src/ColorGradientPicker.tsx`:

(a) 상수와 ref 추가 — 파일 상단 컴포넌트 안, `const wrapRef = ...` 다음에:

```tsx
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ stop: "start" | "end"; moved: boolean } | null>(null);
```

파일 상단(컴포넌트 밖, `deriveEndColor` 근처)에:

```tsx
const MIN_GAP = 10;      // 두 스톱 최소 간격(%)
const DRAG_THRESHOLD = 3; // px — 이보다 크게 움직이면 드래그로 간주(탭 아님)
const HANDLE_INSET = 16;  // px — 핸들 반지름만큼 트랙 안으로
```

(b) 드래그 핸들러 추가 — `swap()` 함수 다음에:

```tsx
  function posFromClientX(clientX: number): number {
    const el = barRef.current; if (!el) return 0;
    const r = el.getBoundingClientRect();
    const usable = r.width - HANDLE_INSET * 2;
    const raw = (clientX - r.left - HANDLE_INSET) / (usable || 1);
    return Math.max(0, Math.min(100, Math.round(raw * 100)));
  }

  function onHandlePointerDown(stop: "start" | "end", e: React.PointerEvent) {
    if (parsed.kind !== "gradient") { setActive(active ? null : "start"); return; }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { stop, moved: false };
    const startX = e.clientX;
    function move(ev: PointerEvent) {
      if (!dragRef.current) return;
      if (Math.abs(ev.clientX - startX) > DRAG_THRESHOLD) dragRef.current.moved = true;
      if (!dragRef.current.moved) return;
      if (parsed.kind !== "gradient") return;
      let p = posFromClientX(ev.clientX);
      if (dragRef.current.stop === "start") p = Math.min(p, parsed.endPos - MIN_GAP);
      else p = Math.max(p, parsed.startPos + MIN_GAP);
      p = Math.max(0, Math.min(100, p));
      if (dragRef.current.stop === "start") emit({ ...parsed, startPos: p });
      else emit({ ...parsed, endPos: p });
    }
    function up(ev: PointerEvent) {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const wasDrag = dragRef.current?.moved;
      dragRef.current = null;
      if (!wasDrag) setActive((a) => (a === stop ? null : stop)); // 탭 = 팔레트 토글
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
```

(c) 바 컨테이너에 `ref`·`data-testid` 추가, 핸들 버튼의 `onClick`을 `onPointerDown`으로 교체. 바 `<div>`를 다음으로 교체:

```tsx
      <div ref={barRef} data-testid="gradient-bar" style={{ position: "relative", height: 34, borderRadius: 9, background: isGradient
          ? `linear-gradient(90deg, ${parsed.start} ${parsed.startPos}%, ${parsed.end} ${parsed.endPos}%)`
          : (parsed.kind === "solid" ? parsed.hex : ""),
        boxShadow: "0 0 0 1px rgba(0,0,0,.06)" }}>
        {parsed.kind === "solid" ? (
          <button type="button" aria-label="색" style={handleStyle(parsed.hex, active === "start", "50%")}
            onPointerDown={(e) => onHandlePointerDown("start", e)} />
        ) : (
          <>
            <button type="button" aria-label="시작 색" style={handleStyle(parsed.start, active === "start", `${HANDLE_INSET}px`)}
              onPointerDown={(e) => onHandlePointerDown("start", e)} />
            <button type="button" aria-label="끝 색" style={handleStyle(parsed.end, active === "end", `calc(100% - ${HANDLE_INSET}px)`)}
              onPointerDown={(e) => onHandlePointerDown("end", e)} />
          </>
        )}
      </div>
```

Note: 인셋 핸들 시각 위치는 `HANDLE_INSET`px 고정(항상 트랙 안). 스톱 위치(%)는 바 배경 그라데이션과 저장값에만 반영 — 시안에서 합의한 "핸들은 트랙 안, 값은 0~100% 매핑"과 일치.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @tablign/ui test -- ColorGradientPicker`
Expected: PASS (6 tests). 단색 핸들 탭 테스트(Task 2)도 `onPointerDown` 경로로 여전히 통과 — solid 분기에서 즉시 `setActive` 호출.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @tablign/ui lint`
Expected: no output.

```bash
git add packages/ui/src/ColorGradientPicker.tsx packages/ui/src/__tests__/ColorGradientPicker.test.tsx
git commit -m "[기능] 그라데이션 핸들 드래그로 비율(스톱 위치) 조정"
```

---

### Task 4: OrgFormDialog 커스텀 색 슬롯을 그라데이션 편집기로 교체

색상 섹션의 커스텀 슬롯 팝오버(현재 `<ColorPicker>`)를 `<ColorGradientPicker>`로 교체한다. 프리셋 단색 8칸은 유지. 커스텀 값이 그라데이션 문자열이어도 `hasCustom`/`customColor` 로직이 그대로 동작하는지 확인한다.

**Files:**
- Modify: `apps/extension/src/newtab/OrgFormDialog.tsx`
  - import (2행): `ColorGradientPicker` 추가.
  - 커스텀 슬롯 팝오버(291–299행 부근 `<ColorPicker ...>`) 교체.
  - 커스텀 슬롯 미리보기 배경(278행 `background: customColor`)이 그라데이션 문자열도 그대로 받으므로 변경 불필요 — 단, `customSelected` 링 색(277행)이 그라데이션이면 CSS box-shadow 색으로 부적절하므로 처리(아래).

**Interfaces:**
- Consumes: `ColorGradientPicker` (Task 2/3), 기존 `color`/`setColor`/`customColor`/`setCustomColor` 상태.
- Produces: 없음(내부 통합).

- [ ] **Step 1: Update import**

`apps/extension/src/newtab/OrgFormDialog.tsx` 2행을 다음으로 교체:

```tsx
import { theme, Button, overlayAnimationCss, overlayIn, panelIn, ColorPicker, ColorGradientPicker } from "@tablign/ui";
```

(주의: `ColorPicker`는 다른 곳에서 더는 안 쓰면 제거. 실제로 교체 후 파일 내 `<ColorPicker` 사용처가 남지 않으면 import에서 `ColorPicker`를 빼 lint 경고를 피한다.)

- [ ] **Step 2: Replace the popover contents**

`pickerOpen &&` 팝오버 안의 `<ColorPicker value={color} onChange={...} />`(297행 부근)를 다음으로 교체:

```tsx
                    <ColorGradientPicker value={color} previewIcon={icon} onChange={(c) => { setColor(c); if (!SWATCHES.includes(c)) setCustomColor(c); }} />
```

그리고 이 팝오버 컨테이너의 `width: 240`(356행 부근)을 편집기 폭에 맞춰 `width: 256`으로 넉넉히(편집기 224 + padding). 팔레트가 편집기 아래로 더 내려오므로 팝오버 높이 추정 상수 `COLOR_POPOVER_HEIGHT`(100행 부근, 현재 300)를 `420`으로 올려 위/아래 뒤집힘 판정이 넉넉하도록 한다.

- [ ] **Step 3: Guard the custom-slot ring for gradients**

커스텀 슬롯 버튼(273–284행)의 선택 링은 `customColor`를 box-shadow 색으로 쓴다(277행). 그라데이션 문자열은 box-shadow 색으로 못 쓰므로, 그라데이션일 땐 accent로 대체한다. 277행 부근을 다음으로 교체:

```tsx
                      boxShadow: customSelected ? `0 0 0 1.5px ${theme.surface}, 0 0 0 3px ${(customColor as string).startsWith("#") ? customColor : theme.accent}` : "none",
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @tablign/extension lint`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/extension/src/newtab/OrgFormDialog.tsx
git commit -m "[기능] 조직 색상 커스텀 슬롯을 그라데이션 편집기로 교체"
```

---

### Task 5: 저장 경로 통합 테스트 + 렌더 확인

그라데이션을 지정하고 저장하면 `updateOrganization`에 그라데이션 문자열이 전달되고, 레일·헤더가 그 값을 background로 렌더하는지 확인한다.

**Files:**
- Modify: `apps/extension/src/newtab/NewTab.test.tsx` (테스트 1건 추가)

**Interfaces:**
- Consumes: 기존 테스트 하네스(`renderNewTab`, `updateOrganization` 목, 기본 org 목). Task 4 통합.
- Produces: 없음.

- [ ] **Step 1: Write the test**

`apps/extension/src/newtab/NewTab.test.tsx`의 "조직 생성·편집 다이얼로그" describe 블록 끝에 추가. (팀 조직 편집 흐름은 기존 "팀 조직 관리자가 헤더 아바타(편집)를 클릭…" 테스트와 동일한 셋업을 사용 — 그 테스트의 `listOrganizations`/`listMyOrgMemberships`/`listSpaces` 목 구성을 그대로 복제한다.)

```tsx
it("프로필 설정에서 그라데이션을 지정하면 그라데이션 문자열로 저장된다", async () => {
  listOrganizations.mockResolvedValue([
    { id: "org-personal", name: "개인", icon: null, color: null, owner_id: "u1", is_personal: true, created_at: "" },
    { id: "org-team", name: "우리팀", icon: "🚀", color: "#20a97e", owner_id: "u1", is_personal: false, created_at: "x" },
  ]);
  listMyOrgMemberships.mockResolvedValue([{ org_id: "org-team", user_id: "u1", role: "owner", created_at: "x" }]);
  listSpaces.mockResolvedValue([
    { id: "s1", user_id: "u1", name: "개인", icon: null, position: 1000, created_at: "x", org_id: "org-personal" },
  ]);
  renderNewTab();
  await screen.findAllByText("개인");

  fireEvent.click(screen.getByText("우리팀"));
  fireEvent.click(await screen.findByRole("button", { name: "조직 관리" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "프로필 설정" }));
  const dialog = await screen.findByRole("dialog", { name: "프로필 설정" });

  // 커스텀 색 슬롯을 열어 편집기 → 그라데이션 토글
  fireEvent.click(within(dialog).getByRole("button", { name: "색상 직접 선택" }));
  fireEvent.click(await within(dialog).findByRole("button", { name: "그라데이션" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "저장" }));

  await waitFor(() =>
    expect(updateOrganization).toHaveBeenCalledWith(
      expect.anything(), "org-team",
      expect.objectContaining({ color: expect.stringMatching(/^linear-gradient\(135deg,/) }),
    ),
  );
});
```

Note: 커스텀 슬롯을 아직 안 연 초기 상태에선 aria-label이 "색상 직접 선택"(＋ 버튼, 285행)이다. 열려 있으면 편집기가 팝오버에 렌더된다.

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @tablign/extension test -- NewTab`
Expected: PASS (기존 + 신규 1건).

만약 커스텀 슬롯 초기 상태가 달라 aria-label이 안 잡히면, `screen.debug()`로 실제 라벨을 확인해 셀렉터를 맞춘다(＋ 버튼 `aria-label="색상 직접 선택"` vs 기억된 커스텀 슬롯 `aria-label="커스텀 색 …"`). 기본 팀 목의 color가 `#20a97e`(프리셋 아님)이므로 초기부터 "커스텀 색 #20A97E" 슬롯이 보일 수 있다 — 그 경우 그 슬롯 안의 수정 배지(`aria-label="커스텀 색 수정"`, 280행)를 클릭해 편집기를 연다. 두 경로 중 실제 렌더에 맞는 셀렉터를 사용.

- [ ] **Step 3: Full suite + commit**

Run: `pnpm --filter @tablign/ui test && pnpm --filter @tablign/extension test`
Expected: 모든 테스트 PASS.

Run: `pnpm --filter @tablign/ui lint && pnpm --filter @tablign/extension lint`
Expected: no output.

```bash
git add apps/extension/src/newtab/NewTab.test.tsx
git commit -m "[테스트] 프로필 색상 그라데이션 저장 경로 검증"
```

---

## Self-Review

**Spec coverage:**
- 저장 형식(단색/그라데이션/퍼센트 생략/시작=끝 정규화) → Task 1 ✓
- 편집기(토글·사각 미리보기·인셋 핸들 바·스왑·HEX는 팔레트에만) → Task 2 ✓
- 135° 고정 → Task 1 GRAD_RE·buildColorValue ✓
- 비율 드래그(인셋 핸들·최소 간격·탭vs드래그) → Task 3 ✓
- 팔레트 팝오버(ColorPicker 재사용) → Task 2 ✓
- OrgFormDialog 통합, 프리셋 유지 → Task 4 ✓
- 팀·개인 공통(개인 프로필 설정은 같은 다이얼로그) → Task 4/5 ✓
- 렌더는 문자열 background 그대로 → Task 5 통합 테스트로 확인, 렌더 코드 변경 없음 ✓
- 하위호환(기존 hex 로드) → Task 1 parseColorValue ✓

**Placeholder scan:** 코드 블록 모두 실제 구현 포함. "적절히 처리" 류 없음.

**Type consistency:** `ColorValue`/`parseColorValue`/`buildColorValue`/`DEFAULT_COLOR_VALUE`(Task 1) → Task 2/3에서 동일 시그니처 사용. `ColorGradientPickerProps { value, onChange, previewIcon }`(Task 2) → Task 4에서 동일 prop명(`value`,`previewIcon`,`onChange`) 사용. aria-label 문자열(단색/그라데이션/색/시작 색/끝 색/시작 끝 색 교환) Task 2·3·5 일치.
