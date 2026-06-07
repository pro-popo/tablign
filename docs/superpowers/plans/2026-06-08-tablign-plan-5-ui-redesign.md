# tablign Plan 5 — UI/UX 리디자인 ("Studio") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 웹·확장의 UI를 "Studio" 룩(라이트+인디고, Lucide 아이콘, 3단 접이식 셸, 그룹형 보드)으로 리디자인하고, 확장 새 탭에 OPEN TABS 패널(탭 드래그 저장)을 추가한다.

**Architecture:** 공용 표시 컴포넌트를 `@tablign/ui`에 재정비(토큰·아이콘·프리미티브·AppShell·Board/CollectionSection·LinkCard·Toast)하고 웹·확장이 공유한다. 데이터 접근(`@tablign/core`)과 웹 훅(`queries.ts`)·Realtime은 그대로 두고 새 컴포넌트에 재연결한다. 스타일은 기존 코드베이스 관행을 따라 인라인 스타일 + 공유 토큰 상수로 작성(새 CSS 툴체인 도입 없음).

**Tech Stack:** React 18, TypeScript, lucide-react, @dnd-kit/core, TanStack Query(웹), Vite(확장), Vitest + Testing Library.

**Prerequisites:** Plan 1~4 완료. 로컬 Supabase 실행 중. 설계: `docs/superpowers/specs/2026-06-08-tablign-ui-redesign-design.md`.

**디자인 토큰(theme.ts 기준값):** accent `#3b5bdb`, accentWeak `#edf0fe`, text `#1f2430`, textMuted `#868e96`, textFaint `#adb5bd`, border `#eaecef`, borderCard `#e9ebee`, bg `#fcfcfd`, surface `#fff`, surface2 `#f1f3f5`, danger `#e03131`.

---

## File Structure

```
packages/ui/src/
├── theme.ts                 신규: 디자인 토큰 상수
├── icons.ts                 신규: lucide-react 재export
├── Button.tsx               신규: Button, IconButton
├── Card.tsx                 신규: Card(공통 카드 표면)
├── InlineInput.tsx          신규: 인라인 생성 입력(Enter 확정/Esc 취소)
├── EmptyState.tsx           신규: 빈 상태 안내
├── Toast.tsx                신규: ToastProvider + useToast
├── Favicon.tsx              신규: 파비콘 + globe 폴백
├── LinkCard.tsx             재작성: Studio 스타일 + hover 액션
├── CollectionSection.tsx    신규: 섹션(헤더+카드 그리드+링크추가+접기)
├── Board.tsx                재작성: 세로 섹션 스택 컨테이너
├── SidePanel.tsx            신규: 접이식 좌/우 패널 컨테이너
├── AppShell.tsx             신규: 3단 셸(left/center/right + 접힘 props)
├── index.ts                 갱신: 위 export, CollectionColumn/AddLinkInput 제거
└── (삭제) CollectionColumn.tsx, AddLinkInput.tsx + 각 테스트

apps/web/src/
├── lib/usePanelState.ts     신규: localStorage 접힘 상태 훅
├── app/dashboard/
│   ├── Sidebar.tsx          신규: 스페이스·검색·태그(좌 패널 내용)
│   ├── Toolbar.tsx          신규: 상단 바(스페이스명·＋컬렉션·펼치기/접기)
│   └── DashboardClient.tsx  재작성: AppShell+Board(sections), prompt 제거
└── (SearchBar.tsx/TagBar.tsx는 Sidebar로 흡수 또는 재사용)

apps/extension/src/
├── lib/tabs.ts              추가: groupTabsByWindow
├── lib/usePanelState.ts     신규: chrome.storage 접힘 상태 훅
├── newtab/OpenTabsPanel.tsx 신규: 창별 그룹 + 드래그 소스 + 저장/닫기
└── newtab/NewTab.tsx        재작성: AppShell+Board+OpenTabsPanel
```

의존성 추가: `lucide-react`(packages/ui, apps/web, apps/extension), `@dnd-kit/core`(apps/extension).

---

## Task 1: @tablign/ui — 토큰 · 아이콘 · 의존성

**Files:**
- Create: `packages/ui/src/theme.ts`
- Create: `packages/ui/src/icons.ts`
- Modify: `packages/ui/package.json` (lucide-react 의존성)

- [ ] **Step 1: package.json에 lucide-react 추가**

`packages/ui/package.json`의 `dependencies`를 다음으로 교체:

```json
  "dependencies": {
    "@tablign/core": "workspace:*",
    "lucide-react": "^0.460.0"
  },
```

Run: `pnpm install`

- [ ] **Step 2: theme.ts 작성**

Create `packages/ui/src/theme.ts`:

```typescript
export const theme = {
  accent: "#3b5bdb",
  accentWeak: "#edf0fe",
  text: "#1f2430",
  textMuted: "#868e96",
  textFaint: "#adb5bd",
  border: "#eaecef",
  borderCard: "#e9ebee",
  bg: "#fcfcfd",
  surface: "#ffffff",
  surface2: "#f1f3f5",
  danger: "#e03131",
  radiusCard: 9,
  radiusBtn: 7,
  radiusChip: 8,
} as const;
```

- [ ] **Step 3: icons.ts 작성**

Create `packages/ui/src/icons.ts`:

```typescript
export {
  Search,
  Hash,
  Tag,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  ChevronRight,
  Download,
  X,
  ExternalLink,
  Trash2,
  Globe,
  LogOut,
} from "lucide-react";
```

- [ ] **Step 4: 타입 체크**

Run: `pnpm --filter @tablign/ui lint`
Expected: tsc PASS.

- [ ] **Step 5: 커밋**

```bash
git add packages/ui/package.json packages/ui/src/theme.ts packages/ui/src/icons.ts pnpm-lock.yaml
git commit -m "feat(ui): 디자인 토큰 + Lucide 아이콘 모듈 추가"
```

---

## Task 2: 프리미티브 — Button · IconButton · Card · InlineInput · EmptyState (TDD)

**Files:**
- Create: `packages/ui/src/Button.tsx`
- Create: `packages/ui/src/Card.tsx`
- Create: `packages/ui/src/EmptyState.tsx`
- Create: `packages/ui/src/InlineInput.tsx`
- Create: `packages/ui/src/__tests__/InlineInput.test.tsx`

- [ ] **Step 1: 실패 테스트 작성 (InlineInput)**

Create `packages/ui/src/__tests__/InlineInput.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InlineInput } from "../InlineInput";

describe("InlineInput", () => {
  it("Enter로 값을 제출하고 입력을 비운다", () => {
    const onSubmit = vi.fn();
    render(<InlineInput placeholder="컬렉션 이름" onSubmit={onSubmit} onCancel={() => {}} />);
    const input = screen.getByPlaceholderText("컬렉션 이름") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "새 컬렉션" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("새 컬렉션");
    expect(input.value).toBe("");
  });

  it("빈 값은 제출하지 않는다", () => {
    const onSubmit = vi.fn();
    render(<InlineInput placeholder="x" onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.keyDown(screen.getByPlaceholderText("x"), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Esc로 취소한다", () => {
    const onCancel = vi.fn();
    render(<InlineInput placeholder="x" onSubmit={() => {}} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByPlaceholderText("x"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tablign/ui test InlineInput`
Expected: FAIL — `../InlineInput` 없음.

- [ ] **Step 3: 구현 — Button.tsx**

Create `packages/ui/src/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { theme } from "./theme";

type Variant = "primary" | "ghost" | "outline";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const styles: Record<Variant, React.CSSProperties> = {
  primary: { background: theme.accent, color: "#fff", border: "none" },
  ghost: { background: "transparent", color: theme.textMuted, border: "none" },
  outline: { background: "#fff", color: "#5c636b", border: `1px solid ${theme.border}` },
};

export function Button({ variant = "primary", children, style, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 11px",
        borderRadius: theme.radiusBtn,
        fontWeight: 600,
        fontSize: 13,
        cursor: "pointer",
        ...styles[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function IconButton({ children, style, ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 7,
        border: "none",
        background: "transparent",
        color: theme.textFaint,
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: 구현 — Card.tsx**

Create `packages/ui/src/Card.tsx`:

```tsx
import type { CSSProperties, ReactNode } from "react";
import { theme } from "./theme";

export function Card({
  children,
  style,
  ...rest
}: { children: ReactNode; style?: CSSProperties } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      style={{
        background: theme.surface,
        border: `1px solid ${theme.borderCard}`,
        borderRadius: theme.radiusCard,
        padding: "10px 11px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 5: 구현 — EmptyState.tsx**

Create `packages/ui/src/EmptyState.tsx`:

```tsx
import type { ReactNode } from "react";
import { theme } from "./theme";

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div style={{ padding: 24, textAlign: "center", color: theme.textMuted }}>
      <div style={{ marginBottom: action ? 10 : 0 }}>{title}</div>
      {action}
    </div>
  );
}
```

- [ ] **Step 6: 구현 — InlineInput.tsx**

Create `packages/ui/src/InlineInput.tsx`:

```tsx
import { useState } from "react";
import { theme } from "./theme";

export interface InlineInputProps {
  placeholder: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  autoFocus?: boolean;
}

export function InlineInput({ placeholder, onSubmit, onCancel, autoFocus = true }: InlineInputProps) {
  const [value, setValue] = useState("");

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const trimmed = value.trim();
      if (!trimmed) return;
      onSubmit(trimmed);
      setValue("");
    } else if (e.key === "Escape") {
      onCancel();
    }
  }

  return (
    <input
      autoFocus={autoFocus}
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKey}
      onBlur={onCancel}
      style={{
        width: "100%",
        padding: "7px 9px",
        border: `1px solid ${theme.accent}`,
        borderRadius: theme.radiusBtn,
        fontSize: 13,
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  );
}
```

- [ ] **Step 7: 통과 확인 + lint**

Run: `pnpm --filter @tablign/ui test InlineInput` → 3 PASS.
Run: `pnpm --filter @tablign/ui lint` → tsc PASS.

- [ ] **Step 8: 커밋**

```bash
git add packages/ui/src/Button.tsx packages/ui/src/Card.tsx packages/ui/src/EmptyState.tsx packages/ui/src/InlineInput.tsx packages/ui/src/__tests__/InlineInput.test.tsx
git commit -m "feat(ui): 프리미티브(Button/IconButton/Card/InlineInput/EmptyState) 추가"
```

---

## Task 3: Favicon + LinkCard 재작성 (TDD)

**Files:**
- Create: `packages/ui/src/Favicon.tsx`
- Modify: `packages/ui/src/LinkCard.tsx`
- Modify: `packages/ui/src/__tests__/LinkCard.test.tsx`

- [ ] **Step 1: LinkCard 테스트 재작성**

Replace `packages/ui/src/__tests__/LinkCard.test.tsx` with:

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
  it("custom_title > title > 도메인 순으로 라벨을 보여준다", () => {
    const { rerender } = render(<LinkCard link={baseLink} onOpen={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("예시 제목")).toBeInTheDocument();
    rerender(<LinkCard link={{ ...baseLink, custom_title: "내 제목" }} onOpen={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("내 제목")).toBeInTheDocument();
    rerender(<LinkCard link={{ ...baseLink, title: null }} onOpen={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });

  it("카드를 클릭하면 onOpen(url)이 호출된다", () => {
    const onOpen = vi.fn();
    render(<LinkCard link={baseLink} onOpen={onOpen} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /예시 제목/ }));
    expect(onOpen).toHaveBeenCalledWith("https://example.com/page");
  });

  it("삭제 버튼을 누르면 onDelete(id)가 호출된다", () => {
    const onDelete = vi.fn();
    render(<LinkCard link={baseLink} onOpen={() => {}} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tablign/ui test LinkCard`
Expected: FAIL (현재 LinkCard에 onDelete/삭제 버튼 없음).

- [ ] **Step 3: Favicon 구현**

Create `packages/ui/src/Favicon.tsx`:

```tsx
import { useState } from "react";
import { Globe } from "./icons";
import { theme } from "./theme";

export function Favicon({ url, size = 16 }: { url: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return <Globe size={size} color={theme.textFaint} strokeWidth={2} />;
  }
  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      style={{ borderRadius: 4, flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
}
```

- [ ] **Step 4: LinkCard 재작성**

Replace `packages/ui/src/LinkCard.tsx`:

```tsx
import { useState } from "react";
import type { Link } from "@tablign/core";
import { Favicon } from "./Favicon";
import { ExternalLink, Trash2 } from "./icons";
import { theme } from "./theme";

export interface LinkCardProps {
  link: Link;
  onOpen: (url: string) => void;
  onDelete: (id: string) => void;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function LinkCard({ link, onOpen, onDelete }: LinkCardProps) {
  const [hover, setHover] = useState(false);
  const label = link.custom_title ?? link.title ?? domainOf(link.url);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        background: theme.surface,
        border: `1px solid ${theme.borderCard}`,
        borderRadius: theme.radiusCard,
        padding: "10px 11px",
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(link.url)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          gap: 8,
          alignItems: "center",
          width: "100%",
        }}
      >
        <Favicon url={link.favicon_url} />
        <span
          style={{
            fontWeight: 600,
            color: theme.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      </button>
      <div style={{ color: theme.textFaint, fontSize: 11, marginTop: 5 }}>{domainOf(link.url)}</div>
      {hover && (
        <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 2 }}>
          <button
            type="button"
            aria-label="열기"
            onClick={() => onOpen(link.url)}
            style={{ border: "none", background: theme.surface2, borderRadius: 6, padding: 4, cursor: "pointer", display: "flex" }}
          >
            <ExternalLink size={14} color={theme.textMuted} />
          </button>
          <button
            type="button"
            aria-label="삭제"
            onClick={() => onDelete(link.id)}
            style={{ border: "none", background: theme.surface2, borderRadius: 6, padding: 4, cursor: "pointer", display: "flex" }}
          >
            <Trash2 size={14} color={theme.danger} />
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: 통과 확인 + lint**

Run: `pnpm --filter @tablign/ui test LinkCard` → 3 PASS.
Run: `pnpm --filter @tablign/ui lint` → tsc PASS.

- [ ] **Step 6: 커밋**

```bash
git add packages/ui/src/Favicon.tsx packages/ui/src/LinkCard.tsx packages/ui/src/__tests__/LinkCard.test.tsx
git commit -m "feat(ui): Favicon 폴백 + LinkCard Studio 재작성(hover 액션)"
```

---

## Task 4: CollectionSection + Board 재작성 (TDD), CollectionColumn/AddLinkInput 제거

**Files:**
- Create: `packages/ui/src/CollectionSection.tsx`
- Modify: `packages/ui/src/Board.tsx`
- Create: `packages/ui/src/__tests__/CollectionSection.test.tsx`
- Delete: `packages/ui/src/CollectionColumn.tsx`, `packages/ui/src/AddLinkInput.tsx`, `packages/ui/src/__tests__/AddLinkInput.test.tsx`

- [ ] **Step 1: CollectionSection 테스트 작성**

Create `packages/ui/src/__tests__/CollectionSection.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CollectionSection } from "../CollectionSection";
import type { Collection, Link } from "@tablign/core";

const collection: Collection = {
  id: "c1", space_id: "s1", user_id: "u1", title: "읽을거리",
  icon: null, note: null, position: 1000, created_at: "2026-01-01T00:00:00Z",
};
const links: Link[] = [
  { id: "l1", collection_id: "c1", user_id: "u1", url: "https://a.com", title: "A", favicon_url: null, thumbnail_url: null, custom_title: null, position: 1000, created_at: "x" },
];

function noop() {}

describe("CollectionSection", () => {
  it("제목과 링크 개수를 보여준다", () => {
    render(
      <CollectionSection collection={collection} links={links}
        onOpenLink={noop} onDeleteLink={noop} onAddLink={noop} onOpenAll={noop} onDeleteCollection={noop} />,
    );
    expect(screen.getByText("읽을거리")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("헤더의 접기 버튼을 누르면 링크가 숨겨진다", () => {
    render(
      <CollectionSection collection={collection} links={links}
        onOpenLink={noop} onDeleteLink={noop} onAddLink={noop} onOpenAll={noop} onDeleteCollection={noop} />,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "섹션 접기" }));
    expect(screen.queryByText("A")).not.toBeInTheDocument();
  });

  it("링크 추가를 열고 Enter로 onAddLink를 호출한다", () => {
    const onAddLink = vi.fn();
    render(
      <CollectionSection collection={collection} links={links}
        onOpenLink={noop} onDeleteLink={noop} onAddLink={onAddLink} onOpenAll={noop} onDeleteCollection={noop} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "링크 추가" }));
    const input = screen.getByPlaceholderText("URL 붙여넣기") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://x.com" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAddLink).toHaveBeenCalledWith("https://x.com");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tablign/ui test CollectionSection`
Expected: FAIL — `../CollectionSection` 없음.

- [ ] **Step 3: CollectionSection 구현**

Create `packages/ui/src/CollectionSection.tsx`:

```tsx
import { useState } from "react";
import type { Collection, Link } from "@tablign/core";
import { LinkCard } from "./LinkCard";
import { InlineInput } from "./InlineInput";
import { ChevronDown, ChevronRight, ExternalLink, Plus, Trash2 } from "./icons";
import { theme } from "./theme";

export interface CollectionSectionProps {
  collection: Collection;
  links: Link[];
  collapsed?: boolean;
  isOver?: boolean;
  onOpenLink: (url: string) => void;
  onDeleteLink: (id: string) => void;
  onAddLink: (url: string) => void;
  onOpenAll: (collectionId: string) => void;
  onDeleteCollection: (collectionId: string) => void;
}

export function CollectionSection({
  collection, links, collapsed: collapsedProp, isOver,
  onOpenLink, onDeleteLink, onAddLink, onOpenAll, onDeleteCollection,
}: CollectionSectionProps) {
  const [collapsed, setCollapsed] = useState(!!collapsedProp);
  const [adding, setAdding] = useState(false);

  return (
    <section
      style={{
        marginBottom: 22,
        padding: 8,
        borderRadius: 12,
        border: isOver ? `1.5px dashed ${theme.accent}` : "1.5px dashed transparent",
        background: isOver ? theme.accentWeak : "transparent",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <button
          type="button"
          aria-label={collapsed ? "섹션 펼치기" : "섹션 접기"}
          onClick={() => setCollapsed((c) => !c)}
          style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 2 }}
        >
          {collapsed ? <ChevronRight size={16} color={theme.textMuted} /> : <ChevronDown size={16} color={theme.textMuted} />}
        </button>
        <strong style={{ color: "#3b3f46" }}>
          {collection.icon ? `${collection.icon} ` : ""}{collection.title}
        </strong>
        <span style={{ color: theme.textFaint, fontSize: 12 }}>{links.length}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
          <button type="button" aria-label="링크 추가" onClick={() => setAdding(true)} style={iconBtn}>
            <Plus size={15} color={theme.textMuted} />
          </button>
          <button type="button" aria-label="모두 열기" onClick={() => onOpenAll(collection.id)} style={iconBtn}>
            <ExternalLink size={15} color={theme.textMuted} />
          </button>
          <button type="button" aria-label="컬렉션 삭제" onClick={() => onDeleteCollection(collection.id)} style={iconBtn}>
            <Trash2 size={15} color={theme.danger} />
          </button>
        </span>
      </header>
      {!collapsed && (
        <>
          {adding && (
            <div style={{ marginBottom: 8 }}>
              <InlineInput
                placeholder="URL 붙여넣기"
                onSubmit={(url) => { onAddLink(url); setAdding(false); }}
                onCancel={() => setAdding(false)}
              />
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 9 }}>
            {links.map((link) => (
              <LinkCard key={link.id} link={link} onOpen={onOpenLink} onDelete={onDeleteLink} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

const iconBtn: React.CSSProperties = {
  border: "none", background: "none", cursor: "pointer", display: "flex", padding: 3, borderRadius: 6,
};
```

- [ ] **Step 4: Board 재작성**

Replace `packages/ui/src/Board.tsx`:

```tsx
import type { ReactNode } from "react";

export interface BoardProps {
  children: ReactNode;
}

export function Board({ children }: BoardProps) {
  return <div style={{ padding: "16px 18px", overflow: "auto", height: "100%", boxSizing: "border-box" }}>{children}</div>;
}
```

- [ ] **Step 5: CollectionColumn/AddLinkInput 제거**

```bash
git rm packages/ui/src/CollectionColumn.tsx packages/ui/src/AddLinkInput.tsx packages/ui/src/__tests__/AddLinkInput.test.tsx
```

- [ ] **Step 6: 통과 확인**

Run: `pnpm --filter @tablign/ui test CollectionSection` → 3 PASS.

- [ ] **Step 7: 커밋**

```bash
git add packages/ui/src/CollectionSection.tsx packages/ui/src/Board.tsx packages/ui/src/__tests__/CollectionSection.test.tsx
git commit -m "feat(ui): CollectionSection+세로 Board 도입, CollectionColumn/AddLinkInput 제거"
```

---

## Task 5: AppShell + SidePanel + Toast (TDD), index.ts 정리

**Files:**
- Create: `packages/ui/src/SidePanel.tsx`
- Create: `packages/ui/src/AppShell.tsx`
- Create: `packages/ui/src/Toast.tsx`
- Create: `packages/ui/src/__tests__/AppShell.test.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: AppShell 테스트 작성**

Create `packages/ui/src/__tests__/AppShell.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppShell } from "../AppShell";

describe("AppShell", () => {
  it("left/center/right 슬롯을 렌더한다", () => {
    render(
      <AppShell
        leftOpen rightOpen
        onToggleLeft={() => {}} onToggleRight={() => {}}
        left={<div>LEFT</div>} right={<div>RIGHT</div>}
      >
        <div>CENTER</div>
      </AppShell>,
    );
    expect(screen.getByText("LEFT")).toBeInTheDocument();
    expect(screen.getByText("CENTER")).toBeInTheDocument();
    expect(screen.getByText("RIGHT")).toBeInTheDocument();
  });

  it("right가 닫히면 right 내용이 숨고 열기 버튼이 보인다", () => {
    const onToggleRight = vi.fn();
    render(
      <AppShell
        leftOpen rightOpen={false}
        onToggleLeft={() => {}} onToggleRight={onToggleRight}
        left={<div>LEFT</div>} right={<div>RIGHT</div>}
      >
        <div>CENTER</div>
      </AppShell>,
    );
    expect(screen.queryByText("RIGHT")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "열린 탭 열기" }));
    expect(onToggleRight).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tablign/ui test AppShell`
Expected: FAIL — `../AppShell` 없음.

- [ ] **Step 3: SidePanel 구현**

Create `packages/ui/src/SidePanel.tsx`:

```tsx
import type { ReactNode } from "react";
import { theme } from "./theme";

export function SidePanel({
  side, width, children,
}: { side: "left" | "right"; width: number; children: ReactNode }) {
  return (
    <aside
      style={{
        width,
        flexShrink: 0,
        background: theme.surface,
        [side === "left" ? "borderRight" : "borderLeft"]: `1px solid ${theme.border}`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {children}
    </aside>
  );
}
```

- [ ] **Step 4: AppShell 구현**

Create `packages/ui/src/AppShell.tsx`:

```tsx
import type { ReactNode } from "react";
import { SidePanel } from "./SidePanel";
import { Button } from "./Button";
import { PanelRightOpen } from "./icons";
import { theme } from "./theme";

export interface AppShellProps {
  left: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}

export function AppShell({ left, right, children, leftOpen, rightOpen, onToggleRight }: AppShellProps) {
  return (
    <div style={{ display: "flex", height: "100vh", background: theme.bg, color: theme.text, fontFamily: "-apple-system, system-ui, sans-serif", fontSize: 13 }}>
      {leftOpen && <SidePanel side="left" width={212}>{left}</SidePanel>}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}>
        {children}
        {right && !rightOpen && (
          <div style={{ position: "absolute", top: 10, right: 12 }}>
            <Button variant="outline" aria-label="열린 탭 열기" onClick={onToggleRight}>
              <PanelRightOpen size={15} /> 열린 탭
            </Button>
          </div>
        )}
      </main>
      {right && rightOpen && <SidePanel side="right" width={272}>{right}</SidePanel>}
    </div>
  );
}
```

(좌측 접힘 시 슬림 레일은 웹/확장의 Sidebar가 `leftOpen=false`일 때 자체적으로 아이콘 레일을 렌더하도록 Task 7/11에서 처리. AppShell은 `leftOpen=false`면 좌 패널을 렌더하지 않는다.)

- [ ] **Step 5: Toast 구현**

Create `packages/ui/src/Toast.tsx`:

```tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { theme } from "./theme";

interface ToastItem { id: number; message: string }
interface ToastCtx { show: (message: string) => void }

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((message: string) => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 2600);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div style={{ position: "fixed", bottom: 16, right: 16, display: "flex", flexDirection: "column", gap: 8, zIndex: 1000 }}>
        {items.map((t) => (
          <div key={t.id} role="status" style={{ background: theme.text, color: "#fff", borderRadius: 8, padding: "9px 13px", fontSize: 13, boxShadow: "0 4px 14px rgba(0,0,0,.18)" }}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
```

- [ ] **Step 6: index.ts 갱신**

Replace `packages/ui/src/index.ts`:

```typescript
export * from "./theme";
export * from "./icons";
export * from "./Button";
export * from "./Card";
export * from "./EmptyState";
export * from "./InlineInput";
export * from "./Favicon";
export * from "./LinkCard";
export * from "./CollectionSection";
export * from "./Board";
export * from "./SidePanel";
export * from "./AppShell";
export * from "./Toast";
```

- [ ] **Step 7: 통과 + lint + 전체 ui 테스트**

Run: `pnpm --filter @tablign/ui test` → 전체 PASS(InlineInput 3 + LinkCard 3 + CollectionSection 3 + AppShell 2).
Run: `pnpm --filter @tablign/ui lint` → tsc PASS.

- [ ] **Step 8: 커밋**

```bash
git add packages/ui/src
git commit -m "feat(ui): AppShell+SidePanel+Toast 추가, index 정리"
```

---

## Task 6: 웹 — usePanelState 훅 (TDD)

**Files:**
- Create: `apps/web/src/lib/usePanelState.ts`
- Create: `apps/web/src/lib/usePanelState.test.ts`
- Modify: `apps/web/package.json` (lucide-react)

- [ ] **Step 1: lucide-react 의존성 추가**

`apps/web/package.json` dependencies에 추가:
```json
"lucide-react": "^0.460.0",
```
Run: `pnpm install`

- [ ] **Step 2: 실패 테스트 작성**

Create `apps/web/src/lib/usePanelState.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from "vitest";
import { readPanelState, writePanelState, type PanelState } from "./usePanelState";

const store: Record<string, string> = {};
const fakeStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = v; },
} as Pick<Storage, "getItem" | "setItem">;

describe("panel state 직렬화", () => {
  beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

  it("저장한 상태를 다시 읽는다", () => {
    const state: PanelState = { left: false, right: true };
    writePanelState(fakeStorage, state);
    expect(readPanelState(fakeStorage)).toEqual(state);
  });

  it("저장값이 없으면 기본값(둘 다 열림)을 반환한다", () => {
    expect(readPanelState(fakeStorage)).toEqual({ left: true, right: true });
  });

  it("손상된 값이면 기본값으로 폴백한다", () => {
    store["tablign.panels"] = "not-json";
    expect(readPanelState(fakeStorage)).toEqual({ left: true, right: true });
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm --filter @tablign/web test usePanelState`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: 구현**

Create `apps/web/src/lib/usePanelState.ts`:

```typescript
"use client";

import { useEffect, useState } from "react";

export interface PanelState {
  left: boolean;
  right: boolean;
}

const KEY = "tablign.panels";
const DEFAULT: PanelState = { left: true, right: true };

export function readPanelState(storage: Pick<Storage, "getItem">): PanelState {
  try {
    const raw = storage.getItem(KEY);
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
    storage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function usePanelState() {
  const [state, setState] = useState<PanelState>(DEFAULT);

  useEffect(() => {
    setState(readPanelState(window.localStorage));
  }, []);

  function toggle(key: keyof PanelState) {
    setState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writePanelState(window.localStorage, next);
      return next;
    });
  }

  return { state, toggleLeft: () => toggle("left"), toggleRight: () => toggle("right") };
}
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm --filter @tablign/web test usePanelState` → 3 PASS.

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/lib/usePanelState.ts apps/web/src/lib/usePanelState.test.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): 패널 접힘 상태 훅(usePanelState) 추가"
```

---

## Task 7: 웹 — Sidebar + Toolbar 컴포넌트

**Files:**
- Create: `apps/web/src/app/dashboard/Sidebar.tsx`
- Create: `apps/web/src/app/dashboard/Toolbar.tsx`

기존 `SearchBar.tsx`/`TagBar.tsx`의 로직(useSearch/useTags/useCollectionIdsForTag)을 Sidebar/Toolbar에서 재사용한다. `SearchBar.tsx`는 Sidebar 내부 검색으로 흡수하되, 파일은 남겨두고 Sidebar에서 `<SearchBar />`를 재사용해도 된다(중복 줄이기). 여기서는 Sidebar가 검색·스페이스·태그필터를 담당한다.

- [ ] **Step 1: Sidebar 작성**

Create `apps/web/src/app/dashboard/Sidebar.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { Space, Tag } from "@tablign/core";
import { Hash, Plus, Search, PanelLeftClose } from "@tablign/ui";
import { theme, InlineInput } from "@tablign/ui";

export interface SidebarProps {
  spaces: Space[];
  tags: Tag[];
  activeSpaceId: string | null;
  activeTagId: string | null;
  onSelectSpace: (id: string) => void;
  onToggleTag: (id: string) => void;
  onAddSpace: (name: string) => void;
  onCollapse: () => void;
  searchSlot: React.ReactNode;
}

export function Sidebar({
  spaces, tags, activeSpaceId, activeTagId,
  onSelectSpace, onToggleTag, onAddSpace, onCollapse, searchSlot,
}: SidebarProps) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: theme.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>t</div>
          <strong>tablign</strong>
        </div>
        <button type="button" aria-label="사이드바 접기" onClick={onCollapse} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
          <PanelLeftClose size={16} color={theme.textFaint} />
        </button>
      </div>
      <div style={{ padding: "11px 12px" }}>{searchSlot}</div>
      <div style={{ padding: "4px 14px", fontSize: 10, letterSpacing: 1, color: theme.textFaint }}>SPACES</div>
      <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        {spaces.map((s) => {
          const active = s.id === activeSpaceId;
          return (
            <button key={s.id} type="button" onClick={() => onSelectSpace(s.id)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                background: active ? theme.accentWeak : "transparent", color: active ? theme.accent : "#495057", fontWeight: active ? 600 : 400, textAlign: "left" }}>
              <Hash size={15} /> {s.name}
            </button>
          );
        })}
        {adding ? (
          <div style={{ padding: "2px 6px" }}>
            <InlineInput placeholder="스페이스 이름" onSubmit={(v) => { onAddSpace(v); setAdding(false); }} onCancel={() => setAdding(false)} />
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", color: theme.textFaint }}>
            <Plus size={15} /> 스페이스 추가
          </button>
        )}
      </div>
      {tags.length > 0 && (
        <>
          <div style={{ padding: "12px 14px 4px", fontSize: 10, letterSpacing: 1, color: theme.textFaint }}>TAGS</div>
          <div style={{ padding: "0 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {tags.map((t) => {
              const active = t.id === activeTagId;
              return (
                <button key={t.id} type="button" onClick={() => onToggleTag(t.id)}
                  style={{ fontSize: 11, borderRadius: theme.radiusChip, padding: "3px 9px", cursor: "pointer",
                    border: `1px solid ${active ? theme.accent : theme.border}`, background: active ? theme.accent : "#fff", color: active ? "#fff" : "#5c636b" }}>
                  #{t.name}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Toolbar 작성**

Create `apps/web/src/app/dashboard/Toolbar.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button, InlineInput, theme } from "@tablign/ui";
import { Plus } from "@tablign/ui";

export interface ToolbarProps {
  spaceName: string;
  collectionCount: number;
  canAdd: boolean;
  onAddCollection: (title: string) => void;
}

export function Toolbar({ spaceName, collectionCount, canAdd, onAddCollection }: ToolbarProps) {
  const [adding, setAdding] = useState(false);
  return (
    <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}`, background: theme.surface }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontSize: 15 }}>{spaceName}</strong>
        <span style={{ color: theme.textFaint }}>· {collectionCount} 컬렉션</span>
      </div>
      {adding ? (
        <div style={{ width: 220 }}>
          <InlineInput placeholder="컬렉션 제목" onSubmit={(v) => { onAddCollection(v); setAdding(false); }} onCancel={() => setAdding(false)} />
        </div>
      ) : (
        <Button onClick={() => setAdding(true)} disabled={!canAdd}>
          <Plus size={15} /> 컬렉션
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: lint**

Run: `pnpm --filter @tablign/web lint` 또는 `pnpm --filter @tablign/web build`(타입 확인). 아직 미사용 import 경고가 없도록 두 컴포넌트만으로는 빌드되지 않을 수 있으니 다음 Task에서 함께 빌드한다. 여기서는 파일 작성만.

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/app/dashboard/Sidebar.tsx apps/web/src/app/dashboard/Toolbar.tsx
git commit -m "feat(web): Studio Sidebar/Toolbar 컴포넌트 추가"
```

---

## Task 8: 웹 — DashboardClient 재작성 (AppShell + 섹션 보드 + 토스트, prompt 제거)

**Files:**
- Modify: `apps/web/src/app/dashboard/DashboardClient.tsx`
- Modify: `apps/web/src/app/providers.tsx` (ToastProvider 래핑)

- [ ] **Step 1: providers에 ToastProvider 추가**

Replace `apps/web/src/app/providers.tsx`:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@tablign/ui";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: DashboardClient 재작성**

Replace `apps/web/src/app/dashboard/DashboardClient.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useDraggable, useDroppable, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { AppShell, Board, CollectionSection, EmptyState, Button, useToast } from "@tablign/ui";
import type { Collection, Link } from "@tablign/core";
import { positionBetween } from "@tablign/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSpaces, useCreateSpace, useCollections, useCreateCollection, useDeleteCollection,
  useLinks, useAddLink, useDeleteLink, useTags, useCollectionIdsForTag,
  moveLink, supabase,
} from "@/lib/queries";
import { usePanelState } from "@/lib/usePanelState";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { SearchBar } from "./SearchBar";

function openUrl(url: string) {
  window.open(url, "_blank", "noopener");
}

function SectionContainer({ collection, userId }: { collection: Collection; userId: string }) {
  const { data: links = [] } = useLinks(collection.id);
  const addLink = useAddLink(collection.id);
  const deleteLink = useDeleteLink(collection.id);
  const deleteCollection = useDeleteCollection(collection.space_id);
  const toast = useToast();
  const { setNodeRef, isOver } = useDroppable({ id: collection.id, data: { collectionId: collection.id } });

  return (
    <div ref={setNodeRef}>
      <CollectionSection
        collection={collection}
        links={links}
        isOver={isOver}
        onOpenLink={openUrl}
        onDeleteLink={(id) => deleteLink.mutate(id)}
        onAddLink={(url) => { addLink.mutate({ user_id: userId, url }); toast.show("링크를 추가했어요"); }}
        onOpenAll={() => links.forEach((l) => openUrl(l.url))}
        onDeleteCollection={(id) => { deleteCollection.mutate(id); toast.show("컬렉션을 삭제했어요"); }}
      />
    </div>
  );
}

// 드래그 가능한 링크는 LinkCard를 감싸지 않고 CollectionSection 내부에서 처리하지 않으므로,
// 여기서는 컬렉션 간 이동을 위해 LinkCard 대신 섹션 전체를 droppable로, 링크 드래그는 생략(향후).
// (Plan 2의 링크 드래그는 섹션 구조에서 재설계 대상 — 이번엔 OPEN TABS 드래그가 핵심이라 웹은 droppable만 유지.)

export function DashboardClient({ userId, userEmail }: { userId: string; userEmail: string }) {
  const { data: spaces = [] } = useSpaces();
  const { data: tags = [] } = useTags();
  const createSpace = useCreateSpace();
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const { state: panels, toggleLeft, toggleRight } = usePanelState();
  const toast = useToast();

  useEffect(() => {
    if (!activeSpaceId && spaces.length > 0) setActiveSpaceId(spaces[0].id);
  }, [spaces, activeSpaceId]);

  const { data: collections = [] } = useCollections(activeSpaceId);
  const createCollection = useCreateCollection(activeSpaceId);
  const { data: taggedIds } = useCollectionIdsForTag(activeTagId);

  const visible = activeTagId ? collections.filter((c) => (taggedIds ?? []).includes(c.id)) : collections;
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  return (
    <AppShell
      leftOpen={panels.left}
      rightOpen={false}
      onToggleLeft={toggleLeft}
      onToggleRight={toggleRight}
      left={
        <Sidebar
          spaces={spaces}
          tags={tags}
          activeSpaceId={activeSpaceId}
          activeTagId={activeTagId}
          onSelectSpace={setActiveSpaceId}
          onToggleTag={(id) => setActiveTagId((cur) => (cur === id ? null : id))}
          onAddSpace={(name) => { createSpace.mutate({ user_id: userId, name }); toast.show("스페이스를 추가했어요"); }}
          onCollapse={toggleLeft}
          searchSlot={<SearchBar />}
        />
      }
    >
      {!panels.left && (
        <div style={{ position: "absolute", top: 10, left: 12, zIndex: 5 }}>
          <Button variant="outline" onClick={toggleLeft}>≡ 메뉴</Button>
        </div>
      )}
      <Toolbar
        spaceName={activeSpace?.name ?? "—"}
        collectionCount={collections.length}
        canAdd={!!activeSpaceId}
        onAddCollection={(title) => { if (activeSpaceId) { createCollection.mutate({ user_id: userId, space_id: activeSpaceId, title }); toast.show("컬렉션을 추가했어요"); } }}
      />
      <Board>
        {visible.length === 0 ? (
          <EmptyState title="아직 컬렉션이 없어요. 상단 ‘＋ 컬렉션’으로 시작하세요." />
        ) : (
          visible.map((c) => <SectionContainer key={c.id} collection={c} userId={userId} />)
        )}
      </Board>
    </AppShell>
  );
}
```

참고: 웹은 OPEN TABS가 없으므로 `rightOpen={false}`, `right` 미전달. `userEmail`은 현재 미표시(원하면 Sidebar 하단에 추가 가능하나 YAGNI로 생략). 링크의 컬렉션 간 드래그는 이번 리디자인에서 droppable 골격만 유지(드래그 소스 재배선은 OPEN TABS와 함께 확장에서 핵심 적용; 웹 링크 드래그 복원은 후속).

- [ ] **Step 3: 빌드**

Run: `pnpm --filter @tablign/web build`
Expected: 빌드 성공. (미사용 import가 있으면 제거.)

- [ ] **Step 4: 수동 확인(선택)**

`pnpm --filter @tablign/web dev` → 로그인 후 새 룩, 인라인 컬렉션/스페이스 추가, 태그 필터, 검색, 사이드바 접기 동작 확인.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/app/dashboard/DashboardClient.tsx apps/web/src/app/providers.tsx
git commit -m "feat(web): 대시보드 Studio 리디자인(AppShell+섹션 보드+토스트, prompt 제거)"
```

---

## Task 9: 확장 — groupTabsByWindow (TDD)

**Files:**
- Modify: `apps/extension/src/lib/tabs.ts`
- Modify: `apps/extension/src/lib/tabs.test.ts`

- [ ] **Step 1: 테스트 추가**

`apps/extension/src/lib/tabs.test.ts` 상단 import에 `groupTabsByWindow` 추가하고, 파일 끝에 추가:

```typescript
import { groupTabsByWindow, type WindowTab } from "./tabs";

describe("groupTabsByWindow", () => {
  const tabs: WindowTab[] = [
    { id: 1, windowId: 10, url: "https://a.com", title: "A", favIconUrl: undefined },
    { id: 2, windowId: 10, url: "https://b.com", title: "B", favIconUrl: undefined },
    { id: 3, windowId: 20, url: "https://c.com", title: "C", favIconUrl: undefined },
  ];

  it("windowId 별로 그룹화하고 순서를 유지한다", () => {
    const groups = groupTabsByWindow(tabs);
    expect(groups).toHaveLength(2);
    expect(groups[0].windowId).toBe(10);
    expect(groups[0].tabs.map((t) => t.id)).toEqual([1, 2]);
    expect(groups[1].windowId).toBe(20);
    expect(groups[1].tabs.map((t) => t.id)).toEqual([3]);
  });
});
```

(상단에 이미 `import { tabsToLinkInputs } ...`가 있으므로, `groupTabsByWindow`/`WindowTab` import를 그 줄에 합치거나 새 import 줄로 추가한다.)

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tablign/extension test`
Expected: FAIL — `groupTabsByWindow` 없음.

- [ ] **Step 3: 구현 추가**

`apps/extension/src/lib/tabs.ts` 끝에 추가:

```typescript
export interface WindowTab {
  id?: number;
  windowId?: number;
  url?: string;
  title?: string;
  favIconUrl?: string;
}

export interface WindowGroup {
  windowId: number;
  tabs: WindowTab[];
}

export function groupTabsByWindow(tabs: WindowTab[]): WindowGroup[] {
  const order: number[] = [];
  const map = new Map<number, WindowTab[]>();
  for (const tab of tabs) {
    const wid = tab.windowId ?? 0;
    if (!map.has(wid)) {
      map.set(wid, []);
      order.push(wid);
    }
    map.get(wid)!.push(tab);
  }
  return order.map((windowId) => ({ windowId, tabs: map.get(windowId)! }));
}
```

- [ ] **Step 4: 통과 + lint**

Run: `pnpm --filter @tablign/extension test` → 전체 PASS(기존 3 + group 1).
Run: `pnpm --filter @tablign/extension lint` → tsc PASS.

- [ ] **Step 5: 커밋**

```bash
git add apps/extension/src/lib/tabs.ts apps/extension/src/lib/tabs.test.ts
git commit -m "feat(extension): groupTabsByWindow 추가"
```

---

## Task 10: 확장 — usePanelState(chrome.storage) + OpenTabsPanel (TDD)

**Files:**
- Create: `apps/extension/src/lib/usePanelState.ts`
- Create: `apps/extension/src/newtab/OpenTabsPanel.tsx`
- Create: `apps/extension/src/newtab/OpenTabsPanel.test.tsx`
- Modify: `apps/extension/package.json` (lucide-react, @dnd-kit/core)
- Modify: `apps/extension/vitest.config.ts` (jsdom로 변경)

- [ ] **Step 1: 의존성 + vitest 환경**

`apps/extension/package.json` dependencies에 추가:
```json
"@dnd-kit/core": "^6.1.0",
"lucide-react": "^0.460.0",
```
devDependencies에 추가(컴포넌트 테스트용):
```json
"@testing-library/react": "^16.0.0",
"@testing-library/jest-dom": "^6.4.0",
"jsdom": "^25.0.0",
```
Run: `pnpm install`

Replace `apps/extension/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { globals: true, environment: "jsdom", setupFiles: ["./src/test-setup.ts"] },
});
```
Create `apps/extension/src/test-setup.ts`:
```typescript
import "@testing-library/jest-dom/vitest";
```
(기존 `tabs.test.ts`는 node 기능만 쓰므로 jsdom에서도 통과한다.)

- [ ] **Step 2: usePanelState(chrome.storage) 구현**

Create `apps/extension/src/lib/usePanelState.ts`:

```typescript
import { useEffect, useState } from "react";

export interface PanelState { left: boolean; right: boolean }
const KEY = "tablign.panels";
const DEFAULT: PanelState = { left: true, right: true };

export function usePanelState() {
  const [state, setState] = useState<PanelState>(DEFAULT);

  useEffect(() => {
    chrome.storage.local.get(KEY, (res) => {
      const v = res[KEY];
      if (v && typeof v.left === "boolean" && typeof v.right === "boolean") setState(v);
    });
  }, []);

  function toggle(key: keyof PanelState) {
    setState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      chrome.storage.local.set({ [KEY]: next });
      return next;
    });
  }

  return { state, toggleLeft: () => toggle("left"), toggleRight: () => toggle("right") };
}
```

- [ ] **Step 3: OpenTabsPanel 테스트 작성**

Create `apps/extension/src/newtab/OpenTabsPanel.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { OpenTabsPanel } from "./OpenTabsPanel";
import type { WindowGroup } from "../lib/tabs";

const groups: WindowGroup[] = [
  { windowId: 10, tabs: [
    { id: 1, windowId: 10, url: "https://a.com", title: "탭 A", favIconUrl: undefined },
    { id: 2, windowId: 10, url: "https://b.com", title: "탭 B", favIconUrl: undefined },
  ] },
];

function renderPanel(props: Partial<React.ComponentProps<typeof OpenTabsPanel>> = {}) {
  return render(
    <DndContext>
      <OpenTabsPanel groups={groups} onSaveWindow={() => {}} onCloseTab={() => {}} onCollapse={() => {}} {...props} />
    </DndContext>,
  );
}

describe("OpenTabsPanel", () => {
  it("창과 탭 제목을 보여준다", () => {
    renderPanel();
    expect(screen.getByText("창 1")).toBeInTheDocument();
    expect(screen.getByText("탭 A")).toBeInTheDocument();
    expect(screen.getByText("탭 B")).toBeInTheDocument();
  });

  it("창 전체 저장 버튼이 onSaveWindow(windowId)를 호출한다", () => {
    const onSaveWindow = vi.fn();
    renderPanel({ onSaveWindow });
    fireEvent.click(screen.getByRole("button", { name: "창 1 전체 저장" }));
    expect(onSaveWindow).toHaveBeenCalledWith(10);
  });

  it("탭 닫기 버튼이 onCloseTab(tabId)를 호출한다", () => {
    const onCloseTab = vi.fn();
    renderPanel({ onCloseTab });
    fireEvent.click(screen.getByRole("button", { name: "탭 A 닫기" }));
    expect(onCloseTab).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 4: 실패 확인**

Run: `pnpm --filter @tablign/extension test OpenTabsPanel`
Expected: FAIL — `./OpenTabsPanel` 없음.

- [ ] **Step 5: OpenTabsPanel 구현**

Create `apps/extension/src/newtab/OpenTabsPanel.tsx`:

```tsx
import { useDraggable } from "@dnd-kit/core";
import { ChevronDown, Download, X, PanelRightClose, Favicon, theme } from "@tablign/ui";
import type { WindowGroup, WindowTab } from "../lib/tabs";

function TabRow({ tab, onCloseTab }: { tab: WindowTab; onCloseTab: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `tab-${tab.id}`,
    data: { tab },
  });
  const style: React.CSSProperties = {
    display: "flex", gap: 8, alignItems: "center",
    border: `1px solid ${theme.border}`, borderRadius: 9, padding: "8px 9px", background: "#fff",
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Favicon url={tab.favIconUrl ?? null} />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {tab.title ?? tab.url}
      </span>
      <button type="button" aria-label={`${tab.title ?? tab.url} 닫기`} onClick={() => tab.id != null && onCloseTab(tab.id)}
        style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 2 }}>
        <X size={14} color={theme.textFaint} />
      </button>
    </div>
  );
}

export interface OpenTabsPanelProps {
  groups: WindowGroup[];
  onSaveWindow: (windowId: number) => void;
  onCloseTab: (tabId: number) => void;
  onCollapse: () => void;
}

export function OpenTabsPanel({ groups, onSaveWindow, onCloseTab, onCollapse }: OpenTabsPanelProps) {
  return (
    <>
      <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}` }}>
        <strong style={{ letterSpacing: ".4px" }}>열린 탭</strong>
        <button type="button" aria-label="패널 접기" onClick={onCollapse} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
          <PanelRightClose size={16} color={theme.textFaint} />
        </button>
      </div>
      <div style={{ padding: "11px 13px", overflow: "auto" }}>
        {groups.map((g, i) => (
          <div key={g.windowId} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: theme.textMuted, marginBottom: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><ChevronDown size={15} /> 창 {i + 1}</span>
              <button type="button" aria-label={`창 ${i + 1} 전체 저장`} onClick={() => onSaveWindow(g.windowId)}
                style={{ border: "none", background: "none", cursor: "pointer", display: "flex", color: theme.accent }}>
                <Download size={15} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {g.tabs.map((t) => <TabRow key={t.id} tab={t} onCloseTab={onCloseTab} />)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 6: 통과 + lint**

Run: `pnpm --filter @tablign/extension test` → 전체 PASS(tabs 4 + OpenTabsPanel 3).
Run: `pnpm --filter @tablign/extension lint` → tsc PASS.

- [ ] **Step 7: 커밋**

```bash
git add apps/extension/src/lib/usePanelState.ts apps/extension/src/newtab/OpenTabsPanel.tsx apps/extension/src/newtab/OpenTabsPanel.test.tsx apps/extension/src/test-setup.ts apps/extension/vitest.config.ts apps/extension/package.json pnpm-lock.yaml
git commit -m "feat(extension): OpenTabsPanel + chrome.storage 패널 상태 추가"
```

---

## Task 11: 확장 — NewTab 재작성(AppShell+Board+OpenTabs+드래그 저장) + 빌드/검증

**Files:**
- Modify: `apps/extension/src/newtab/NewTab.tsx`

- [ ] **Step 1: NewTab 재작성**

Replace `apps/extension/src/newtab/NewTab.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { DndContext, PointerSensor, useSensor, useSensors, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { AppShell, Board, CollectionSection, EmptyState, theme, Hash } from "@tablign/ui";
import {
  listSpaces, listCollections, listLinks, createLink, deleteLink, deleteCollection,
  type Collection, type Link,
} from "@tablign/core";
import { supabase } from "../lib/supabase";
import { tabsToLinkInputs, groupTabsByWindow, type WindowGroup } from "../lib/tabs";
import { usePanelState } from "../lib/usePanelState";
import { OpenTabsPanel } from "./OpenTabsPanel";

function openUrl(url: string) { chrome.tabs.create({ url }); }

function SectionContainer({ collection, userId, onChanged }: { collection: Collection; userId: string; onChanged: () => void }) {
  const [links, setLinks] = useState<Link[]>([]);
  const { setNodeRef, isOver } = useDroppable({ id: collection.id, data: { collectionId: collection.id } });

  async function reload() { setLinks(await listLinks(supabase, collection.id)); }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [collection.id, onChanged]);

  return (
    <div ref={setNodeRef}>
      <CollectionSection
        collection={collection}
        links={links}
        isOver={isOver}
        onOpenLink={openUrl}
        onDeleteLink={async (id) => { await deleteLink(supabase, id); reload(); }}
        onAddLink={async (url) => { await createLink(supabase, { user_id: userId, collection_id: collection.id, url }); reload(); }}
        onOpenAll={() => links.forEach((l) => openUrl(l.url))}
        onDeleteCollection={async (id) => { await deleteCollection(supabase, id); onChanged(); }}
      />
    </div>
  );
}

export function NewTab() {
  const [session, setSession] = useState<Session | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [groups, setGroups] = useState<WindowGroup[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const { state: panels, toggleLeft, toggleRight } = usePanelState();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadCollections() {
    const spaces = await listSpaces(supabase);
    setCollections(spaces[0] ? await listCollections(supabase, spaces[0].id) : []);
  }
  useEffect(() => { if (session) loadCollections(); }, [session, reloadKey]);

  async function loadTabs() {
    const tabs = await chrome.tabs.query({});
    setGroups(groupTabsByWindow(tabs as WindowGroup["tabs"]));
  }
  useEffect(() => { if (session) loadTabs(); }, [session]);

  async function handleDragEnd(event: DragEndEvent) {
    const tab = event.active.data.current?.tab as { url?: string; title?: string; favIconUrl?: string } | undefined;
    const collectionId = event.over?.data.current?.collectionId as string | undefined;
    if (!tab || !collectionId || !session) return;
    const [input] = tabsToLinkInputs([tab], session.user.id, collectionId);
    if (!input) return;
    await createLink(supabase, input);
    setReloadKey((k) => k + 1);
  }

  async function saveWindow(windowId: number) {
    if (!session) return;
    const spaces = await listSpaces(supabase);
    let spaceId = spaces[0]?.id;
    if (!spaceId) return;
    const group = groups.find((g) => g.windowId === windowId);
    if (!group) return;
    const idx = groups.findIndex((g) => g.windowId === windowId);
    const col = await listCollections(supabase, spaceId);
    void col;
    const { createCollection } = await import("@tablign/core");
    const created = await createCollection(supabase, { user_id: session.user.id, space_id: spaceId, title: `창 ${idx + 1}` });
    const inputs = tabsToLinkInputs(group.tabs, session.user.id, created.id);
    for (const input of inputs) { try { await createLink(supabase, input); } catch (e) { console.error(e); } }
    setReloadKey((k) => k + 1);
  }

  async function closeTab(tabId: number) {
    await chrome.tabs.remove(tabId);
    loadTabs();
  }

  if (!session) {
    return (
      <div style={{ padding: 40, fontFamily: "system-ui" }}>
        <h2>tablign</h2>
        <p>팝업(확장 아이콘)에서 로그인하면 여기에 컬렉션이 표시됩니다.</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <AppShell
        leftOpen={panels.left}
        rightOpen={panels.right}
        onToggleLeft={toggleLeft}
        onToggleRight={toggleRight}
        left={
          <div style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: theme.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>t</div>
              <strong>tablign</strong>
            </div>
            <div style={{ fontSize: 10, letterSpacing: 1, color: theme.textFaint, marginBottom: 6 }}>SPACES</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: theme.accentWeak, color: theme.accent, fontWeight: 600 }}>
              <Hash size={15} /> 내 컬렉션
            </div>
          </div>
        }
        right={
          <OpenTabsPanel groups={groups} onSaveWindow={saveWindow} onCloseTab={closeTab} onCollapse={toggleRight} />
        }
      >
        <Board>
          {collections.length === 0 ? (
            <EmptyState title="컬렉션이 없어요. 팝업에서 탭을 저장하거나 웹 앱에서 컬렉션을 만들어 보세요." />
          ) : (
            collections.map((c) => <SectionContainer key={c.id} collection={c} userId={session.user.id} onChanged={() => setReloadKey((k) => k + 1)} />)
          )}
        </Board>
      </AppShell>
    </DndContext>
  );
}
```

- [ ] **Step 2: lint + 빌드 + dist 확인**

Run: `pnpm --filter @tablign/extension lint` → tsc PASS.
Run: `pnpm --filter @tablign/extension build` → 빌드 성공.
Run: `ls apps/extension/dist apps/extension/dist/assets` → manifest.json, popup.html, newtab.html, assets/popup.js, assets/newtab.js 존재.

- [ ] **Step 3: 전체 검증**

Run: `pnpm --filter @tablign/ui test` → 전체 PASS.
Run: `pnpm --filter @tablign/web build` → PASS.
Run: `pnpm --filter @tablign/extension test` → 전체 PASS.

- [ ] **Step 4: 수동 검증(사람)**

확장 재빌드 후 `chrome://extensions`에서 새로고침 → 새 탭 열기 → 좌 사이드/우 OPEN TABS 표시, **탭을 컬렉션 섹션으로 드래그해 저장**, 창 전체 저장(⬇), 탭 닫기(✕), 좌·우 패널 접기/펼치기 동작 확인.

- [ ] **Step 5: 커밋**

```bash
git add apps/extension/src/newtab/NewTab.tsx
git commit -m "feat(extension): 새 탭 Studio 리디자인(AppShell+OpenTabs 드래그 저장)"
```

---

## Self-Review 결과

- **Spec 커버리지:** 토큰/아이콘/프리미티브(Task 1·2), LinkCard·Favicon(3), CollectionSection·Board(4), AppShell·SidePanel·Toast·EmptyState(5), 웹 적용·prompt 제거·패널 상태(6·7·8), 확장 OPEN TABS·드래그 저장·창전체저장·탭닫기·패널 상태(9·10·11) — 스펙의 목표/구현순서를 모두 커버.
- **타입 일관성:** `LinkCard`는 `onOpen`+`onDelete` 시그니처로 Task 3 정의 = Task 4(CollectionSection)·8·11 사용 일치. `CollectionSection` props 집합이 웹/확장 컨테이너와 일치. `WindowTab`/`WindowGroup`(Task 9) = OpenTabsPanel(10)·NewTab(11) 사용 일치. `AppShell` props(leftOpen/rightOpen/onToggle*) = 웹·확장 일치. `usePanelState`는 웹(localStorage)·확장(chrome.storage) 각각 정의하되 동일 `{state,toggleLeft,toggleRight}` 형태.
- **Placeholder 스캔:** 모든 코드/명령 실제 내용 포함. Realtime/드래그 등 변경 없는 부분은 명시적으로 "유지/후속"으로 기재.
- **알려진 축소(문서화):** 웹의 링크 컬렉션 간 드래그는 섹션 구조 전환으로 이번엔 droppable 골격만 유지(드래그 소스 재배선은 후속). 좌 패널 "슬림 아이콘 레일"은 단순화해 접힘 시 완전 숨김 + "≡ 메뉴" 재오픈 버튼으로 대체(직관성 유지, 구현 단순화). 확장 새 탭 좌측 스페이스는 "내 컬렉션" 단일 표시(스페이스 전환은 후속).

---

## 다음 단계

Plan 5 완료 시 웹·확장이 통일된 Studio 룩 + OPEN TABS 드래그 저장을 갖춘다. 후속: 다크 모드, 웹 링크 드래그 복원, 확장 스페이스 전환, 컬렉션 커버/썸네일 뷰.
