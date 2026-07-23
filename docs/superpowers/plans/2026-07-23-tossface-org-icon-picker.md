# 조직 아이콘 토스페이스 전환 · 커스텀 이모지 피커 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 조직 아이콘을 토스페이스(Tossface) 폰트로 렌더하고, 조직 아이콘 선택 피커를 토스 이모지 전용 커스텀 컴포넌트로 교체한다.

**Architecture:** 저장 스키마는 그대로(유니코드 이모지 문자열). 렌더 공통 헬퍼 `orgIcon.ts`에 `font-family: Tossface`를 넣어 레일·헤더·다이얼로그 3지점을 일괄 전환. emoji-mart 컴포넌트를 자체 `TossEmojiPicker`로 교체하되 이모지 목록·검색어는 `@emoji-mart/data`를 재사용하고 `version<=14`(Unicode 14.0)로 토스 커버 범위만 노출한다. 폰트는 공식 dist(무변형)를 로컬 번들.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest + @testing-library/react (jsdom), `@emoji-mart/data`(데이터만 유지).

## Global Constraints

- 폰트 로드는 **CDN 금지, 로컬 번들만** (확장 CSP 원칙).
- 토스페이스 폰트 파일은 **무변형·무서브셋**으로 공식 dist 그대로 번들 (라이선스).
- **라이선스 전문 파일 동봉** + **출처 표시** "토스페이스 · 토스팀 제공".
- 저장 스키마(`organizations.icon` 등) **변경 없음**.
- 커밋 컨벤션: `[타입] 명사형` (예: `[기능] 토스 이모지 피커 추가`). `feat(scope):` 금지.
- 토스 커버 범위 = `@emoji-mart/data` emoji `version <= 14`.
- 이모지 렌더 폰트 스택 상수는 `orgIcon.ts`의 `ORG_ICON_FONT` 하나로 통일(DRY).

---

### Task 1: 토스페이스 폰트 번들 + CSS 로드

**Files:**
- Create: `apps/extension/public/fonts/tossface/` (공식 dist 파일들 — woff2/woff + `tossface.css` + `LICENSE`)
- Modify: `apps/extension/newtab.html` (head에 `<link>` 추가)
- Test: `apps/extension/src/newtab/tossfaceAssets.test.ts`

**Interfaces:**
- Produces: 전역에서 `font-family: "Tossface"` 사용 가능. 소비: Task 2·4의 폰트 스택.

> ⚠️ 폰트 파일 취득은 네트워크 다운로드다. **실행 전 사용자 승인 필요.** 승인 후 아래 명령으로 공식 배포본을 받아 dist 폴더를 그대로 복사한다(무변형).

- [ ] **Step 1: 공식 dist 취득 (승인 후)**

```bash
# 스크래치에 clone 후 woff2 12개 + css + LICENSE만 복사 (무변형, ~13MB).
# woff/ttf/otf/svg는 제외 — Chrome은 woff2를 쓰고, css의 woff src는 요청되지 않음.
git clone --depth 1 https://github.com/toss/tossface /tmp/tossface-src
mkdir -p apps/extension/public/fonts/tossface
cp /tmp/tossface-src/dist/TossFaceFontMac-*.woff2 apps/extension/public/fonts/tossface/
cp /tmp/tossface-src/dist/tossface.css apps/extension/public/fonts/tossface/
cp /tmp/tossface-src/LICENSE apps/extension/public/fonts/tossface/LICENSE
ls apps/extension/public/fonts/tossface/
```
Expected: `tossface.css`, `TossFaceFontMac-00.woff2` … `-11.woff2`, `LICENSE` 존재. (css는 저작권 헤더 포함 — 라이선스 clause 2 충족.)

- [ ] **Step 2: 실패 테스트 작성**

```ts
// apps/extension/src/newtab/tossfaceAssets.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const fontDir = resolve(root, "public/fonts/tossface");

describe("Tossface 번들", () => {
  it("공식 dist CSS와 라이선스 전문이 로컬에 번들되어 있다", () => {
    expect(existsSync(resolve(fontDir, "tossface.css"))).toBe(true);
    expect(existsSync(resolve(fontDir, "LICENSE"))).toBe(true);
  });
  it("최소 한 개의 woff2 폰트 파일이 있다", () => {
    expect(existsSync(resolve(fontDir, "TossFaceFontMac-00.woff2"))).toBe(true);
  });
  it("newtab.html이 로컬 tossface.css를 참조한다(CDN 아님)", () => {
    const html = readFileSync(resolve(root, "newtab.html"), "utf8");
    expect(html).toContain("/fonts/tossface/tossface.css");
    expect(html).not.toContain("cdn.jsdelivr.net");
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd apps/extension && pnpm test tossfaceAssets`
Expected: FAIL — newtab.html이 아직 tossface.css를 참조하지 않음.

- [ ] **Step 4: newtab.html에 link 추가**

`apps/extension/newtab.html` `<head>` 안, `<title>` 위에 추가:
```html
    <link rel="stylesheet" href="/fonts/tossface/tossface.css" />
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd apps/extension && pnpm test tossfaceAssets`
Expected: PASS (3 tests)

- [ ] **Step 6: 커밋**

```bash
git add apps/extension/public/fonts/tossface apps/extension/newtab.html apps/extension/src/newtab/tossfaceAssets.test.ts
git commit -m "[기능] 토스페이스 폰트 로컬 번들 및 라이선스 동봉"
```

---

### Task 2: 조직 아이콘 렌더에 토스 폰트 적용

**Files:**
- Modify: `apps/extension/src/newtab/orgIcon.ts`
- Test: `apps/extension/src/newtab/orgIcon.test.ts`

**Interfaces:**
- Produces: `export const ORG_ICON_FONT: string` — 이모지 폰트 스택. `orgIconStyle()` 반환 객체에 `fontFamily: ORG_ICON_FONT` 포함.
- Consumes: Task 1의 `"Tossface"` @font-face.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// apps/extension/src/newtab/orgIcon.test.ts
import { describe, it, expect } from "vitest";
import { orgIconStyle, ORG_ICON_FONT } from "./orgIcon";

describe("orgIconStyle", () => {
  it("이모지 폰트 스택을 Tossface 1순위로 적용한다", () => {
    const s = orgIconStyle({ icon_scale: 100, icon_x: 0, icon_y: 0 }, 32);
    expect(s.fontFamily).toBe(ORG_ICON_FONT);
    expect(ORG_ICON_FONT).toMatch(/^"Tossface"/);
  });
  it("박스 비례 폰트 크기(0.57)를 유지한다", () => {
    const s = orgIconStyle({}, 100);
    expect(s.fontSize).toBe(57);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd apps/extension && pnpm test orgIcon`
Expected: FAIL — `ORG_ICON_FONT` export 없음.

- [ ] **Step 3: orgIcon.ts 수정**

`apps/extension/src/newtab/orgIcon.ts` 상단 `ICON_EMOJI_RATIO` 선언 아래에 추가:
```ts
/** 이모지 렌더 폰트 스택 — 토스페이스 1순위, 없으면 시스템 컬러 이모지로 fallback. 모든 렌더 지점 공통. */
export const ORG_ICON_FONT =
  '"Tossface", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
```
그리고 `orgIconStyle()`의 반환 객체에 `fontFamily`를 추가:
```ts
  return {
    display: "inline-flex",
    fontFamily: ORG_ICON_FONT,
    fontSize: boxSize * ICON_EMOJI_RATIO,
    lineHeight: 1,
    transform: orgIconTransform(o, boxSize),
    willChange: "transform",
  };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd apps/extension && pnpm test orgIcon`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/extension/src/newtab/orgIcon.ts apps/extension/src/newtab/orgIcon.test.ts
git commit -m "[기능] 조직 아이콘 렌더에 토스페이스 폰트 적용"
```

---

### Task 3: 토스 커버 이모지 데이터 헬퍼

**Files:**
- Create: `apps/extension/src/newtab/tossEmoji.ts`
- Test: `apps/extension/src/newtab/tossEmoji.test.ts`

**Interfaces:**
- Produces:
  - `export interface TossEmoji { native: string; name: string; search: string }`
  - `export interface TossCategory { id: string; label: string; tab: string; items: TossEmoji[] }`
  - `export function buildTossCategories(data?: unknown): TossCategory[]`
- Consumes: `@emoji-mart/data`.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// apps/extension/src/newtab/tossEmoji.test.ts
import { describe, it, expect } from "vitest";
import { buildTossCategories } from "./tossEmoji";

const fake = {
  categories: [
    { id: "people", emojis: ["grinning", "newface"] },
    { id: "frequent", emojis: ["grinning"] },
  ],
  emojis: {
    grinning: { name: "Grinning", keywords: ["smile", "happy"], version: 1, skins: [{ native: "😀" }] },
    newface: { name: "New Face", keywords: ["new"], version: 15, skins: [{ native: "🫩" }] },
  },
};

describe("buildTossCategories", () => {
  it("version<=14만 포함하고 그 이상(미커버)은 제외한다", () => {
    const people = buildTossCategories(fake).find((c) => c.id === "people")!;
    expect(people.items.map((i) => i.native)).toEqual(["😀"]);
  });
  it("frequent 등 비표준 카테고리는 제외한다", () => {
    expect(buildTossCategories(fake).some((c) => c.id === "frequent")).toBe(false);
  });
  it("한글 라벨과 대표 탭 이모지를 붙인다", () => {
    const people = buildTossCategories(fake).find((c) => c.id === "people")!;
    expect(people.label).toBe("스마일리 & 사람");
    expect(people.tab).toBe("😀");
  });
  it("keywords+name 소문자 검색 인덱스를 만든다", () => {
    const people = buildTossCategories(fake).find((c) => c.id === "people")!;
    expect(people.items[0].search).toContain("smile");
    expect(people.items[0].search).toContain("grinning");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd apps/extension && pnpm test tossEmoji`
Expected: FAIL — `tossEmoji.ts` 없음.

- [ ] **Step 3: tossEmoji.ts 작성**

```ts
// apps/extension/src/newtab/tossEmoji.ts
import emojiData from "@emoji-mart/data";

/** 토스페이스 커버 범위(Unicode 14.0). emoji-mart 데이터의 version 필드 기준. */
const MAX_VERSION = 14;

/** 카테고리 id → 한글 라벨 + 대표 탭 이모지. 여기 없는 카테고리(frequent 등)는 제외된다. */
const CAT_META: Record<string, { label: string; tab: string }> = {
  people: { label: "스마일리 & 사람", tab: "😀" },
  nature: { label: "동물 & 자연", tab: "🐻" },
  foods: { label: "음식 & 음료", tab: "🍔" },
  activity: { label: "활동", tab: "⚽" },
  places: { label: "여행 & 장소", tab: "✈️" },
  objects: { label: "사물", tab: "💡" },
  symbols: { label: "기호", tab: "❤️" },
  flags: { label: "깃발", tab: "🏳️" },
};

export interface TossEmoji {
  native: string;
  name: string;
  /** keywords + name 을 이어붙인 소문자 검색 인덱스. */
  search: string;
}
export interface TossCategory {
  id: string;
  label: string;
  tab: string;
  items: TossEmoji[];
}

interface RawEmoji {
  name?: string;
  keywords?: string[];
  version?: number;
  skins?: { native?: string }[];
}
interface RawData {
  categories?: { id: string; emojis: string[] }[];
  emojis?: Record<string, RawEmoji>;
}

/** @emoji-mart/data 에서 토스 커버 범위(version<=14)만 뽑아 카테고리 구조로 반환. */
export function buildTossCategories(data: unknown = emojiData): TossCategory[] {
  const d = data as RawData;
  const out: TossCategory[] = [];
  for (const c of d.categories ?? []) {
    const meta = CAT_META[c.id];
    if (!meta) continue;
    const items: TossEmoji[] = [];
    for (const id of c.emojis ?? []) {
      const e = d.emojis?.[id];
      const native = e?.skins?.[0]?.native;
      if (!native) continue;
      if ((e?.version ?? 1) > MAX_VERSION) continue;
      const search = `${(e?.keywords ?? []).join(" ")} ${e?.name ?? ""}`.toLowerCase();
      items.push({ native, name: e?.name ?? id, search });
    }
    if (items.length) out.push({ id: c.id, label: meta.label, tab: meta.tab, items });
  }
  return out;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd apps/extension && pnpm test tossEmoji`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/extension/src/newtab/tossEmoji.ts apps/extension/src/newtab/tossEmoji.test.ts
git commit -m "[기능] 토스 커버 이모지 데이터 헬퍼 추가"
```

---

### Task 4: TossEmojiPicker 컴포넌트

**Files:**
- Create: `apps/extension/src/newtab/TossEmojiPicker.tsx`
- Test: `apps/extension/src/newtab/TossEmojiPicker.test.tsx`

**Interfaces:**
- Produces: `export function TossEmojiPicker(props: { onSelect: (native: string) => void }): JSX.Element`
- Consumes: `buildTossCategories` (Task 3), `ORG_ICON_FONT` (Task 2).

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// apps/extension/src/newtab/TossEmojiPicker.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TossEmojiPicker } from "./TossEmojiPicker";

vi.mock("./tossEmoji", () => ({
  buildTossCategories: () => [
    { id: "people", label: "스마일리 & 사람", tab: "😀", items: [
      { native: "😀", name: "Grinning", search: "smile happy grinning" },
      { native: "😅", name: "Sweat Smile", search: "sweat grin" },
    ] },
    { id: "nature", label: "동물 & 자연", tab: "🐻", items: [
      { native: "🐶", name: "Dog", search: "dog puppy" },
    ] },
  ],
}));

describe("TossEmojiPicker", () => {
  it("카테고리 라벨과 이모지를 렌더한다", () => {
    render(<TossEmojiPicker onSelect={() => {}} />);
    expect(screen.getByText("스마일리 & 사람")).toBeInTheDocument();
    expect(screen.getByText("동물 & 자연")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dog" })).toBeInTheDocument();
  });

  it("이모지를 누르면 onSelect에 native가 전달된다", () => {
    const onSelect = vi.fn();
    render(<TossEmojiPicker onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Dog" }));
    expect(onSelect).toHaveBeenCalledWith("🐶");
  });

  it("검색어로 필터한다", () => {
    render(<TossEmojiPicker onSelect={() => {}} />);
    fireEvent.change(screen.getByLabelText("이모지 검색"), { target: { value: "dog" } });
    expect(screen.getByRole("button", { name: "Dog" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Grinning" })).not.toBeInTheDocument();
  });

  it("결과가 없으면 빈 상태를 보여준다", () => {
    render(<TossEmojiPicker onSelect={() => {}} />);
    fireEvent.change(screen.getByLabelText("이모지 검색"), { target: { value: "존재안함zzz" } });
    expect(screen.getByText("검색 결과가 없어요")).toBeInTheDocument();
  });

  it("이모지에 hover하면 하단 미리보기 이름이 갱신된다", () => {
    render(<TossEmojiPicker onSelect={() => {}} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Dog" }));
    expect(screen.getByTestId("toss-preview-name")).toHaveTextContent("Dog");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd apps/extension && pnpm test TossEmojiPicker`
Expected: FAIL — 컴포넌트 없음.

- [ ] **Step 3: TossEmojiPicker.tsx 작성**

```tsx
// apps/extension/src/newtab/TossEmojiPicker.tsx
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { buildTossCategories } from "./tossEmoji";
import { ORG_ICON_FONT } from "./orgIcon";

export interface TossEmojiPickerProps {
  onSelect: (native: string) => void;
}

export function TossEmojiPicker({ onSelect }: TossEmojiPickerProps) {
  const categories = useMemo(() => buildTossCategories(), []);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<{ native: string; name: string } | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const q = query.trim().toLowerCase();
  const visible = categories
    .map((c) => ({ ...c, items: q ? c.items.filter((it) => it.search.includes(q)) : c.items }))
    .filter((c) => c.items.length);

  return (
    <div style={wrap}>
      <div style={tabsBar}>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            title={c.label}
            aria-label={c.label}
            style={{ ...tabBtn, fontFamily: ORG_ICON_FONT }}
            onClick={() => {
              setQuery("");
              requestAnimationFrame(() => sectionRefs.current[c.id]?.scrollIntoView({ block: "start" }));
            }}
          >
            {c.tab}
          </button>
        ))}
      </div>

      <div style={searchWrap}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="검색"
          aria-label="이모지 검색"
          style={searchInput}
        />
      </div>

      <div style={bodyBox}>
        {visible.length === 0 ? (
          <div style={emptyBox}>검색 결과가 없어요</div>
        ) : (
          visible.map((c) => (
            <div key={c.id} ref={(el) => { sectionRefs.current[c.id] = el; }}>
              <div style={catLabel}>{c.label}</div>
              <div style={grid}>
                {c.items.map((it) => (
                  <button
                    key={it.native}
                    type="button"
                    title={it.name}
                    aria-label={it.name}
                    style={{ ...cell, fontFamily: ORG_ICON_FONT }}
                    onMouseEnter={() => setPreview({ native: it.native, name: it.name })}
                    onFocus={() => setPreview({ native: it.native, name: it.name })}
                    onClick={() => onSelect(it.native)}
                  >
                    {it.native}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={footBox}>
        <span style={{ ...footBig, fontFamily: ORG_ICON_FONT }}>{preview?.native ?? "🚀"}</span>
        <span data-testid="toss-preview-name" style={footName}>{preview?.name ?? "로켓"}</span>
        <span style={attrText}>토스페이스 · 토스팀 제공</span>
      </div>
    </div>
  );
}

const wrap: CSSProperties = { width: 352, maxWidth: "calc(100vw - 48px)", background: "#fff", borderRadius: 14, overflow: "hidden", boxSizing: "border-box" };
const tabsBar: CSSProperties = { display: "flex", gap: 2, padding: "6px 8px", borderBottom: "1px solid #f1f3f5" };
const tabBtn: CSSProperties = { flex: 1, border: "none", background: "none", fontSize: 18, lineHeight: 1, padding: "6px 0", borderRadius: 8, cursor: "pointer" };
const searchWrap: CSSProperties = { padding: "9px 12px" };
const searchInput: CSSProperties = { width: "100%", padding: "8px 11px", border: "1px solid #e2e5ea", borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box" };
const bodyBox: CSSProperties = { height: 264, overflowY: "auto", padding: "0 8px 10px" };
const catLabel: CSSProperties = { fontSize: 11, fontWeight: 600, color: "#adb5bd", padding: "8px 4px 4px", position: "sticky", top: 0, background: "#fff" };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2 };
const cell: CSSProperties = { border: "none", background: "none", fontSize: 22, lineHeight: 1, padding: "5px 0", borderRadius: 7, cursor: "pointer" };
const emptyBox: CSSProperties = { padding: "24px 8px", textAlign: "center", color: "#adb5bd", fontSize: 12.5 };
const footBox: CSSProperties = { borderTop: "1px solid #f1f3f5", padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, minHeight: 44 };
const footBig: CSSProperties = { fontSize: 26 };
const footName: CSSProperties = { fontSize: 12.5, color: "#868e96" };
const attrText: CSSProperties = { marginLeft: "auto", fontSize: 10.5, color: "#ced4da" };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd apps/extension && pnpm test TossEmojiPicker`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/extension/src/newtab/TossEmojiPicker.tsx apps/extension/src/newtab/TossEmojiPicker.test.tsx
git commit -m "[기능] 커스텀 토스 이모지 피커 컴포넌트 추가"
```

---

### Task 5: OrgFormDialog 통합 — emoji-mart 피커 교체

**Files:**
- Modify: `apps/extension/src/newtab/OrgFormDialog.tsx`
- Modify: `apps/extension/src/newtab/NewTab.test.tsx:18-25`

**Interfaces:**
- Consumes: `TossEmojiPicker` (Task 4), `buildTossCategories` (Task 3).
- 기존 유지: `PRESET_EMOJIS`, `customEmoji` 슬롯, `emojiOpen` 팝오버 위치 로직, `onSubmit` 계약.

- [ ] **Step 1: 실패 테스트로 전환 — NewTab.test.tsx 목 교체**

`apps/extension/src/newtab/NewTab.test.tsx`의 18-25행(emoji-mart 목 2개)을 아래로 교체:
```tsx
// 커스텀 토스 피커는 데이터(@emoji-mart/data)를 읽어 렌더하는 컴포넌트라
// jsdom 테스트에서는 가벼운 스텁으로 대체하고, 이모지 선택 플로우만 검증한다.
vi.mock("./TossEmojiPicker", () => ({
  TossEmojiPicker: ({ onSelect }: { onSelect: (n: string) => void }) => (
    <button type="button" onClick={() => onSelect("🎉")}>toss-picker-stub</button>
  ),
}));
```
그리고 416·426·428·432행의 문구 `emoji-mart`/`emoji-mart-stub`를 `toss-picker-stub`에 맞게 수정:
- 428행: `fireEvent.click(await within(dialog).findByText("toss-picker-stub"));`
- 432행: `expect(within(dialog).queryByText("toss-picker-stub")).not.toBeInTheDocument();`
- 416·426행 주석/문구의 "emoji-mart"를 "토스 피커"로 치환(기능 무관, 가독성).

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd apps/extension && pnpm test NewTab`
Expected: FAIL — `OrgFormDialog`가 아직 `TossEmojiPicker`를 렌더하지 않아 `toss-picker-stub`을 못 찾음.

- [ ] **Step 3: OrgFormDialog.tsx — import 정리**

상단 `import Picker from "@emoji-mart/react";` 및 `import emojiData ...`, `import i18n* ...`(4~27행) 전체를 삭제하고 다음으로 교체:
```tsx
import { TossEmojiPicker } from "./TossEmojiPicker";
import { buildTossCategories } from "./tossEmoji";
```

- [ ] **Step 4: OrgFormDialog.tsx — 무작위 풀·i18n 로직 교체**

`EmojiMart*` 인터페이스(54~57행), `RANDOM_ICON_*`(59~78행), `PICKER_I18N*`·`detectPickerLocale`·`PICKER_LOCALE`(80~95행)를 삭제하고, 무작위 풀을 토스 커버 범위로 재구성:
```tsx
// 생성 시 기본 아이콘 후보 — 토스 커버 범위에서, symbols·flags 제외.
const RANDOM_ICON_POOL: string[] = buildTossCategories()
  .filter((c) => c.id !== "symbols" && c.id !== "flags")
  .flatMap((c) => c.items.map((it) => it.native));

function randomIcon(): string {
  if (RANDOM_ICON_POOL.length === 0) return FALLBACK_ICON;
  return RANDOM_ICON_POOL[Math.floor(Math.random() * RANDOM_ICON_POOL.length)];
}
```
(`FALLBACK_ICON = "🚀"`, `PRESET_EMOJIS`, `EMOJI_RING`는 그대로 유지.)

- [ ] **Step 5: OrgFormDialog.tsx — 팝오버 내용 교체**

294~315행의 emoji-mart 팝오버 블록에서 `<style>{"em-emoji-picker { height: 340px; }"}</style>`와 `<Picker .../>`를 삭제하고 다음으로 교체:
```tsx
                  <TossEmojiPicker
                    onSelect={(native) => {
                      setIcon(native);
                      if (!PRESET_EMOJIS.includes(native)) setCustomEmoji(native);
                      setEmojiOpen(false);
                    }}
                  />
```
(팝오버 컨테이너 div·위치 로직 `emojiPlacement`·`EMOJI_POPOVER_HEIGHT`는 그대로 유지.)

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd apps/extension && pnpm test NewTab`
Expected: PASS — 이모지 ＋ → toss-picker-stub → 🎉 선택 → 커스텀 슬롯·제출값 반영.

- [ ] **Step 7: 타입체크·전체 테스트**

Run: `cd apps/extension && pnpm test && pnpm exec tsc --noEmit`
Expected: 전부 PASS, 타입 에러 없음(제거된 emoji-mart import 잔재 없음).

- [ ] **Step 8: 커밋**

```bash
git add apps/extension/src/newtab/OrgFormDialog.tsx apps/extension/src/newtab/NewTab.test.tsx
git commit -m "[기능] 조직 다이얼로그 이모지 피커를 토스 피커로 교체"
```

---

### Task 6: emoji-mart 컴포넌트 의존성 제거

**Files:**
- Modify: `apps/extension/package.json`
- (검증) 저장소 전역 grep

**Interfaces:**
- Consumes: Task 5 완료(더 이상 `@emoji-mart/react`·`emoji-mart` import 없음). `@emoji-mart/data`는 유지.

- [ ] **Step 1: 잔재 없음 확인(실패 조건 검증)**

Run: `grep -rn "@emoji-mart/react\|from \"emoji-mart\"" apps/extension/src`
Expected: 결과 없음. (있으면 Task 5로 돌아가 제거)

- [ ] **Step 2: package.json에서 컴포넌트 의존성 제거**

`apps/extension/package.json` dependencies에서 두 줄 삭제(`@emoji-mart/data`는 남긴다):
```
    "@emoji-mart/react": "^1.1.1",
    "emoji-mart": "^5.6.0",
```

- [ ] **Step 3: 재설치 후 빌드·테스트**

Run:
```bash
cd /Users/jeongjin-a/Desktop/project/tablign && pnpm install
cd apps/extension && pnpm test && pnpm build
```
Expected: install 성공, 모든 테스트 PASS, 빌드 성공.

- [ ] **Step 4: 커밋**

```bash
git add apps/extension/package.json pnpm-lock.yaml
git commit -m "[정리] 미사용 emoji-mart 컴포넌트 의존성 제거"
```

---

## 실기기 검증 (수동)

계획 완료 후 `/run`(또는 확장 로드)으로 새 탭을 띄워:
- 조직 레일·헤더·다이얼로그 아이콘이 토스 스타일로 보이는지
- 다이얼로그 ＋ → 토스 피커가 열리고 카테고리 탭·검색·선택이 동작하는지
- 폰트 로드 전 잠깐 시스템 이모지가 보이는 FOUT 정도가 수용 가능한지 (필요 시 후속으로 `font-display` 조정)

## Self-Review

- **Spec 커버리지:** 3.1 폰트 번들→Task 1 / 3.2 렌더 폰트→Task 2 / 3.3 커스텀 피커→Task 3·4 / 3.4 무작위 풀→Task 5 Step 4 / 3.5 emoji-mart 정리→Task 5·6 / 3.6 테스트→각 Task. 4절(한글 검색)·스페이스·프로필은 범위 밖으로 명시. 라이선스 전문 동봉→Task 1, 출처 표시→Task 4 footer. 모두 매핑됨.
- **플레이스홀더:** 없음(전 스텝 실제 코드·명령·기대값 포함).
- **타입 일관성:** `buildTossCategories`/`TossCategory`/`TossEmoji`/`ORG_ICON_FONT`/`TossEmojiPicker`(props `onSelect`) 이름·시그니처가 Task 3·4·5에서 일치.
