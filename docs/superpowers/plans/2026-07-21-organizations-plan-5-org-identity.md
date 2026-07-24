# 조직 아이콘·색 + 생성/편집 다이얼로그(Phase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 조직을 만들/수정할 때 **이름 + 아이콘(이모지, 없으면 이니셜) + 색**을 지정하는 다이얼로그를 붙인다. 색은 대표 스와치 + 직접 선택(명도·채도 사각형 + Hue 바 + hex). 지정한 아이콘/색이 레일·헤더에 반영된다. 부수적으로 계정 하단에 실제 프로필 사진을 표시한다.

**Architecture:** 데이터 계층(`createOrganization`/`updateOrganization`)과 표시(OrgRail·OrgHeader의 `org.color ?? …`, `org.icon ?? initial`)는 **이미 icon/color를 지원**한다. 이 Phase는 그 값을 **설정하는 UI**만 추가한다: 재사용 `ColorPicker`(@tablign/ui) + `OrgFormDialog`(extension, create/edit 겸용) + NewTab 배선. 스키마 변경 없음.

**Tech Stack:** React(@tablign/ui, 익스텐션 새 탭), TypeScript(@tablign/core 데이터 계층 재사용), Vitest.

## Global Constraints

- 커밋 컨벤션: `[타입] 명사형` Korean; `feat(scope):` 금지.
- **스키마·마이그레이션 변경 없음.** `organizations.icon`(text, 이모지 또는 이니셜 글자)·`color`(text, hex)는 Phase 1에 이미 존재. `createOrganization(client, {name, owner_id, icon?, color?})`·`updateOrganization(client, id, {name?, icon?, color?})` 그대로 사용.
- 다이얼로그 오버레이는 기존 패턴 재사용: `overlayAnimationCss, overlayIn, panelIn`(@tablign/ui `overlayAnimation`), fixed overlay + 중앙 패널 (MemberDialog 참고).
- 색 저장 형식: **hex 문자열**(`#RRGGBB`, 대문자). 아이콘 저장: 이모지 1글자(또는 빈 값 → 표시 시 이름 이니셜 폴백).
- UI에 부가 설명 문구(캡션) 넣지 않음 — 컨트롤만.
- 편집(기존 조직 아이콘/색/이름 변경)은 **owner·admin만**. 생성은 로그인 사용자 누구나(개인 조직 외 팀 조직 생성).
- 테두리 있는 요소엔 `boxSizing:"border-box"`.
- 확정 시안: 아바타 클릭 → 이모지 그리드, 색 = 대표 스와치 + ＋ → B 피커(인라인 펼침).

---

### Task 1: ColorPicker 컴포넌트 (명도·채도 + Hue 바 + hex)

**Files:**
- Create: `packages/ui/src/ColorPicker.tsx`
- Create: `packages/ui/src/color.ts` (순수 변환 유틸)
- Create: `packages/ui/src/__tests__/color.test.ts`
- Modify: `packages/ui/src/index.ts` (export)

**Interfaces:**
- Produces (`color.ts`):
  - `hexToHsv(hex: string): { h: number; s: number; v: number } | null` (h 0–360, s/v 0–1; 잘못된 hex는 null)
  - `hsvToHex(h: number, s: number, v: number): string` (`#RRGGBB` 대문자)
  - `normalizeHex(input: string): string | null` (`#abc`/`abc`/`#aabbcc` → `#AABBCC`, 아니면 null)
- Produces (`ColorPicker.tsx`):
  - `export interface ColorPickerProps { value: string; onChange: (hex: string) => void }`
  - `export function ColorPicker(props: ColorPickerProps): JSX.Element` — SV 사각형(드래그로 s,v) + Hue 바(드래그로 h) + hex 입력 + 미리보기 칩. value(hex)로 초기 상태, 변경 시 onChange(hex).

- [ ] **Step 1: 변환 유틸 테스트 작성 (실패)** — Create `packages/ui/src/__tests__/color.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { hexToHsv, hsvToHex, normalizeHex } from "../color";

describe("color 변환", () => {
  it("hsvToHex 기본색", () => {
    expect(hsvToHex(0, 1, 1)).toBe("#FF0000");
    expect(hsvToHex(120, 1, 1)).toBe("#00FF00");
    expect(hsvToHex(240, 1, 1)).toBe("#0000FF");
    expect(hsvToHex(0, 0, 1)).toBe("#FFFFFF");
    expect(hsvToHex(0, 0, 0)).toBe("#000000");
  });
  it("hexToHsv 왕복(roundtrip) 근사", () => {
    for (const hex of ["#FF0000", "#00FF00", "#3B5BDB", "#1E5AF0"]) {
      const hsv = hexToHsv(hex)!;
      expect(hsvToHex(hsv.h, hsv.s, hsv.v)).toBe(hex);
    }
  });
  it("hexToHsv 잘못된 입력은 null", () => {
    expect(hexToHsv("zzz")).toBeNull();
    expect(hexToHsv("#12")).toBeNull();
  });
  it("normalizeHex", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("3b5bdb")).toBe("#3B5BDB");
    expect(normalizeHex("#3B5BDB")).toBe("#3B5BDB");
    expect(normalizeHex("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: 변환 유틸 구현** — Create `packages/ui/src/color.ts`:
```ts
export function normalizeHex(input: string): string | null {
  let s = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(s)) s = s.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return "#" + s.toUpperCase();
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0").toUpperCase();
  return "#" + to(r) + to(g) + to(b);
}
```

- [ ] **Step 3: 유틸 테스트 통과 확인** — Run: `pnpm --filter @tablign/ui test color.test.ts` → PASS.

- [ ] **Step 4: ColorPicker 컴포넌트 구현** — Create `packages/ui/src/ColorPicker.tsx`. SV 사각형 + Hue 바를 pointer 드래그로 조작, hex 입력 동기화. 부가 캡션 없음.
```tsx
import { useRef, useState, useEffect } from "react";
import { theme } from "./theme";
import { hexToHsv, hsvToHex, normalizeHex } from "./color";

export interface ColorPickerProps { value: string; onChange: (hex: string) => void }

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const init = hexToHsv(value) ?? { h: 222, s: 0.8, v: 0.9 };
  const [h, setH] = useState(init.h);
  const [s, setS] = useState(init.s);
  const [v, setV] = useState(init.v);
  const [hexText, setHexText] = useState(value);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // 외부 value 변경 반영(대표 스와치 클릭 등)
  useEffect(() => { const c = hexToHsv(value); if (c) { setH(c.h); setS(c.s); setV(c.v); setHexText(value); } }, [value]);

  function emit(nh: number, ns: number, nv: number) {
    const hex = hsvToHex(nh, ns, nv);
    setHexText(hex);
    onChange(hex);
  }
  function onSvPointer(e: React.PointerEvent) {
    const el = svRef.current; if (!el) return;
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const ns = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const nv = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
    setS(ns); setV(nv); emit(h, ns, nv);
  }
  function onHuePointer(e: React.PointerEvent) {
    const el = hueRef.current; if (!el) return;
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const nh = Math.min(360, Math.max(0, ((e.clientX - r.left) / r.width) * 360));
    setH(nh); emit(nh, s, v);
  }
  const hueHex = hsvToHex(h, 1, 1);
  const current = hsvToHex(h, s, v);

  return (
    <div>
      <div ref={svRef}
        onPointerDown={onSvPointer}
        onPointerMove={(e) => { if (e.buttons === 1) onSvPointer(e); }}
        style={{ width: "100%", height: 130, borderRadius: 10, position: "relative", cursor: "crosshair", boxSizing: "border-box",
          background: `linear-gradient(to top,#000,rgba(0,0,0,0)), linear-gradient(to right,#fff,${hueHex})` }}>
        <span style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", border: "3px solid #fff", boxShadow: "0 0 0 1px #0004",
          left: `calc(${s * 100}% - 7px)`, top: `calc(${(1 - v) * 100}% - 7px)`, boxSizing: "border-box" }} />
      </div>
      <div ref={hueRef}
        onPointerDown={onHuePointer}
        onPointerMove={(e) => { if (e.buttons === 1) onHuePointer(e); }}
        style={{ height: 14, borderRadius: 7, marginTop: 10, position: "relative", cursor: "pointer",
          background: "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}>
        <span style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 0 0 1px #0004",
          left: `calc(${(h / 360) * 100}% - 8px)`, top: -1, background: hueHex, boxSizing: "border-box" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: current, boxSizing: "border-box" }} />
        <input value={hexText} onChange={(e) => {
            setHexText(e.target.value);
            const n = normalizeHex(e.target.value);
            if (n) { const c = hexToHsv(n)!; setH(c.h); setS(c.s); setV(c.v); onChange(n); }
          }}
          style={{ flex: 1, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "6px 9px", fontSize: 12, fontFamily: "monospace", boxSizing: "border-box" }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: export + 타입체크** — Add `export * from "./ColorPicker";` and `export * from "./color";` to `packages/ui/src/index.ts`. Run `pnpm --filter @tablign/ui lint` → clean.

- [ ] **Step 6: 커밋**
```bash
git add packages/ui/src/ColorPicker.tsx packages/ui/src/color.ts packages/ui/src/__tests__/color.test.ts packages/ui/src/index.ts
git commit -m "[기능] 색 선택기(ColorPicker)·색 변환 유틸"
```

---

### Task 2: OrgFormDialog (조직 생성/편집 다이얼로그)

**Files:**
- Create: `apps/extension/src/newtab/OrgFormDialog.tsx`

**Interfaces:**
- Consumes: `ColorPicker`, `overlayAnimationCss`/`overlayIn`/`panelIn`, `theme` (@tablign/ui).
- Produces:
```ts
export interface OrgFormValue { name: string; icon: string | null; color: string | null }
export interface OrgFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: OrgFormValue;                 // edit 시 기존 값
  onSubmit: (v: OrgFormValue) => void;    // 만들기/저장
  onClose: () => void;
}
export function OrgFormDialog(props: OrgFormDialogProps): JSX.Element | null;
```

- [ ] **Step 1: 컴포넌트 구현** — Create `apps/extension/src/newtab/OrgFormDialog.tsx`. 아바타(클릭 → 이모지 그리드 토글), 이름 입력, 색 = 대표 스와치 + ＋(클릭 → 인라인 ColorPicker 토글). 제목 mode별("새 조직 만들기"/"조직 설정"), 버튼("만들기"/"저장").
  - 상수: `const EMOJIS = ["🙂","🚀","💡","🎨","📚","🏢","⭐","🔥","✅","📌","🧩","🎯","🌱","🏷"];`
  - 상수: `const SWATCHES = ["#E03131","#F59F00","#2F9E44","#0CA678","#1C7ED6","#4263EB","#7048E8","#E64980"];`
  - 상태: `name`, `icon`(string|null), `color`(string, 기본 SWATCHES[5] `#4263EB`), `pickerOpen`(bool), `emojiOpen`(bool). `open`/`initial` 바뀌면 초기화(useEffect).
  - 아바타: `background: color`, 내용 = `icon ?? (name.trim()[0]?.toUpperCase() ?? "?")`, 클릭 시 `emojiOpen` 토글. 우하단 ✎ 배지.
  - 이모지 그리드(emojiOpen): 각 이모지 클릭 → `setIcon(emoji); setEmojiOpen(false)`. "이니셜로" 옵션(icon=null)도 하나 둔다.
  - 색 행: SWATCHES 스와치(클릭 → setColor + pickerOpen 닫기) + `＋`(클릭 → pickerOpen 토글).
  - pickerOpen 시 인라인 `<ColorPicker value={color} onChange={setColor} />`.
  - onSubmit 시 `{ name: name.trim(), icon, color }` 전달(이름 빈값이면 만들기 버튼 비활성).
  - `if (!open) return null;` Escape로 닫기(MemberDialog 패턴). 오버레이 스타일 MemberDialog와 동일.
  - 부가 설명 캡션 없음.

  (전체 구현은 위 확정 시안 `org-create-final.html`의 레이아웃/치수를 그대로 옮긴다: 아바타 56×15R, 스와치 26×8R, 인라인 팝 영역 등. 테두리 요소 `boxSizing:"border-box"`.)

- [ ] **Step 2: 타입체크** — `pnpm --filter @tablign/extension build` → clean.

- [ ] **Step 3: 커밋**
```bash
git add apps/extension/src/newtab/OrgFormDialog.tsx
git commit -m "[기능] 조직 생성·편집 다이얼로그"
```

---

### Task 3: NewTab 배선 — 생성/편집 연결

**Files:**
- Modify: `apps/extension/src/newtab/NewTab.tsx`
- Modify: `apps/extension/src/newtab/OrgHeader.tsx` (조직 아바타 클릭 → 편집)

**Interfaces:**
- Consumes: `OrgFormDialog`, `createOrganization`(icon/color 포함), `updateOrganization`.

- [ ] **Step 1: OrgHeader에 편집 진입점** — Modify `OrgHeader.tsx`:
  - Props에 `onEditOrg?: () => void` 추가.
  - 리딩 아바타(이니셜 배지)를 `onEditOrg`가 있을 때 버튼으로 만들어 클릭 시 `onEditOrg()` 호출(커서 pointer). `onEditOrg`는 owner·admin일 때만 전달(개인 조직·member면 미전달 → 클릭 불가).

- [ ] **Step 2: NewTab 상태·핸들러** — Modify `NewTab.tsx`:
```ts
const [orgFormOpen, setOrgFormOpen] = useState(false);
const [orgFormMode, setOrgFormMode] = useState<"create" | "edit">("create");

function openCreateOrg() { setOrgFormMode("create"); setOrgFormOpen(true); }
function openEditOrg() { if (activeOrg && !activeOrg.is_personal) { setOrgFormMode("edit"); setOrgFormOpen(true); } }

async function submitOrgForm(v: { name: string; icon: string | null; color: string | null }) {
  if (!session) return;
  if (orgFormMode === "create") {
    const org = await createOrganization(supabase, { name: v.name || "새 조직", owner_id: session.user.id, icon: v.icon, color: v.color });
    setOrganizations((prev) => [...prev, org]);
    setActiveOrgId(org.id); setActiveSpaceId(null);
  } else if (activeOrg) {
    const updated = await updateOrganization(supabase, activeOrg.id, { name: v.name || activeOrg.name, icon: v.icon, color: v.color });
    setOrganizations((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }
  setOrgFormOpen(false);
}
```
  - 기존 `createOrg`(레일 ＋ onCreateOrg) 를 `openCreateOrg`로 교체(레일이 다이얼로그를 열도록). 즉 `<OrgRail onCreateOrg={openCreateOrg} .../>`.
  - OrgHeader에 `onEditOrg={(myOrgRole === "owner" || myOrgRole === "admin") ? openEditOrg : undefined}` 전달.

- [ ] **Step 3: OrgFormDialog 렌더** — Add near other dialogs in NewTab JSX:
```tsx
<OrgFormDialog
  open={orgFormOpen}
  mode={orgFormMode}
  initial={orgFormMode === "edit" && activeOrg ? { name: activeOrg.name, icon: activeOrg.icon, color: activeOrg.color } : undefined}
  onSubmit={submitOrgForm}
  onClose={() => setOrgFormOpen(false)}
/>
```
  - Import `OrgFormDialog`.

- [ ] **Step 4: 빌드 + 확인** — `pnpm --filter @tablign/extension build` → clean. 앱에서: 레일 ＋ → 다이얼로그로 이름·아이콘·색 지정 후 만들기 → 레일/헤더에 반영. 헤더 조직 아바타 클릭(owner/admin) → 편집 → 저장 시 반영. (헤드리스 불가 → 사용자 실테스트로 확인.)

- [ ] **Step 5: 커밋**
```bash
git add apps/extension/src/newtab/NewTab.tsx apps/extension/src/newtab/OrgHeader.tsx
git commit -m "[기능] 조직 생성·편집 다이얼로그 배선"
```

---

### Task 4: 계정 하단 실제 프로필 사진

**Files:**
- Modify: `apps/extension/src/newtab/OrgRail.tsx`
- Modify: `apps/extension/src/newtab/NewTab.tsx`

**Interfaces:**
- Produces: `OrgRailProps`에 `avatarUrl?: string | null` 추가.

- [ ] **Step 1: OrgRail 계정 아바타** — Modify `OrgRail.tsx`:
  - Props에 `avatarUrl?: string | null`.
  - 계정 행의 회색 원(`.racct` 대응 span)을, `avatarUrl` 있으면 `background: center/cover url(${avatarUrl})`로, 없으면 기존 회색 유지. `boxSizing:"border-box"` 유지.

- [ ] **Step 2: NewTab에서 전달** — Modify `NewTab.tsx`: `<OrgRail avatarUrl={session.user.user_metadata?.avatar_url ?? null} .../>` (Google OAuth 아바타. `user_metadata`에 없으면 null → 회색 폴백).

- [ ] **Step 3: 빌드 + 커밋** — `pnpm --filter @tablign/extension build` → clean.
```bash
git add apps/extension/src/newtab/OrgRail.tsx apps/extension/src/newtab/NewTab.tsx
git commit -m "[기능] 레일 계정 실제 프로필 사진"
```

---

### Task 5: 테스트 갱신 + 전체 회귀

**Files:**
- Modify: `apps/extension/src/newtab/NewTab.test.tsx`

- [ ] **Step 1: mock 보강** — `@tablign/core` mock에 `updateOrganization: vi.fn().mockResolvedValue({ id:"org-personal", name:"개인", icon:null, color:null, owner_id:"u1", is_personal:true, created_at:"" })` 추가(이미 있으면 유지). `createOrganization` mock이 인자를 반영한 org를 resolve하도록 조정(id 부여). OrgFormDialog/ColorPicker는 렌더만 되면 되므로 별도 mock 불필요.
- [ ] **Step 2: NewTab.test 실행** — `pnpm --filter @tablign/extension test NewTab.test.tsx` → green. 필요 시 최소 수정(레일 ＋가 이제 즉시 생성이 아니라 다이얼로그를 여는 것으로 바뀌었으므로, 그 동작을 검증하던 테스트가 있으면 "다이얼로그 열림"으로 갱신).
- [ ] **Step 3: 전체 회귀** — `pnpm test` (repo root) → 전체 PASS. 총계 보고.
- [ ] **Step 4: 커밋**
```bash
git add apps/extension/src/newtab/NewTab.test.tsx
git commit -m "[테스트] 조직 생성·편집 다이얼로그 회귀 갱신"
```

---

## Self-Review

**Spec coverage (확정 시안):**
- 이름 + 아이콘(이모지/이니셜) + 색(대표+B 피커) 생성 다이얼로그 → Task 2, 3
- B 색 피커(SV+Hue+hex) → Task 1
- 아바타 클릭 → 아이콘 선택 → Task 2
- 아이콘/색이 레일·헤더 반영 → 이미 지원(Task 3에서 값만 설정; 확인)
- 기존 조직 편집(헤더 아바타 클릭, owner/admin) → Task 3
- 계정 실제 프로필 사진 → Task 4

**Placeholder scan:** Task 1은 완전한 코드. Task 2는 시안 파일(`org-create-final.html`)을 참조해 레이아웃 이식으로 안내(치수·상수 명시). Task 3/5는 기존 구조 의존부를 주변 코드 매칭으로 갱신.

**Type consistency:** `OrgFormValue {name, icon:string|null, color:string|null}`가 Task 2 정의와 Task 3 `submitOrgForm`·`createOrganization`/`updateOrganization`(icon?/color? 허용) 인자와 일치. `ColorPickerProps {value,onChange}` Task 1↔Task 2 사용 일치. `Organization.icon/color`는 `string|null`(types.ts) — 다이얼로그 icon/color(null 허용)와 정합.

**주의(실행 시):**
- ColorPicker 드래그는 pointer 이벤트 — 단위테스트는 변환 유틸(color.ts)만, 드래그·렌더는 사용자 실테스트로 확인.
- 레일 ＋ 동작이 "즉시 생성"→"다이얼로그"로 바뀌므로 관련 테스트 갱신(Task 5).
- 아이콘 폴백: `icon`이 null/빈값이면 표시 시 이름 이니셜(레일·헤더·다이얼로그 아바타 모두 동일 규칙).
