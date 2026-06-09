# tablign Plan 6 — 새 탭 다듬기(그리드·미리보기·편집) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 확장 새 탭에서 드롭 위치를 커서 기준으로 정확히 저장하고, 그리드+고스트 미리보기로 들어갈 자리를 보여주며, 컬렉션 생성 즉시 이름 입력 자동 포커스·이름 수정·링크 카드(제목/URL/메모) 편집을 제공한다.

**Architecture:** `links`에 `note` 컬럼을 추가하고 `@tablign/core`의 타입/`updateLink`를 확장한다. 공용 `@tablign/ui`의 LinkCard(편집)·CollectionSection(이름 인라인 편집)을 개선해 웹·확장이 공유한다. 확장의 `DndLinkList`를 반응형 그리드 + 고스트 미리보기로 재작성하고, NewTab의 드롭 판정을 커서 좌표 기준으로 바꾼다.

**Tech Stack:** Supabase(Postgres), TypeScript, React 18, @dnd-kit/core, lucide-react, Vitest + Testing Library.

**Prerequisites:** Plan 1~5 완료 + 현재 브랜치 `fix/extension-dnd-add-collection`(드래그 저장/반응성 수정 포함). 로컬 Supabase 실행 중. `positionForInsert`(`apps/extension/src/lib/order.ts`)와 그 테스트는 이미 존재.

---

## File Structure

```
supabase/migrations/0004_links_note.sql      links.note 추가
packages/core/src/types.ts                    Link.note 추가
packages/core/src/data/links.ts               CreateLinkInput.note, updateLink(url·note)
packages/core/src/__tests__/data.test.ts      updateLink url/note 통합 테스트
packages/ui/src/icons.ts                       Pencil 추가
packages/ui/src/InlineInput.tsx                defaultValue 지원
packages/ui/src/LinkCard.tsx                   편집 모드(제목/URL/메모) + onUpdate
packages/ui/src/CollectionSection.tsx          제목 인라인 편집 + autoEditTitle + onRenameCollection
packages/ui/src/__tests__/LinkCard.test.tsx    편집 테스트 추가
packages/ui/src/__tests__/CollectionSection.test.tsx  이름 편집 테스트 추가
apps/extension/src/newtab/DndLinkList.tsx      그리드 + 고스트 미리보기 재작성
apps/extension/src/newtab/NewTab.tsx           커서 판정·즉시생성+autofocus·이름수정·카드편집 배선
apps/web/src/lib/queries.ts                    useUpdateLink 추가
apps/web/src/app/dashboard/DashboardClient.tsx onUpdate·onRenameCollection 연결
```

---

## Task 1: DB note 컬럼 + core 타입/updateLink (TDD 통합)

**Files:**
- Create: `supabase/migrations/0004_links_note.sql`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/data/links.ts`
- Modify: `packages/core/src/__tests__/data.test.ts`

- [ ] **Step 1: 마이그레이션 작성 + 적용**

Create `supabase/migrations/0004_links_note.sql`:
```sql
alter table public.links add column note text;
```
Run: `pnpm dlx supabase migration up`
Expected: `0004_links_note` 적용 성공.

- [ ] **Step 2: 실패 테스트 추가**

`packages/core/src/__tests__/data.test.ts`의 `../data/links` import에 `updateLink`가 이미 있다(없으면 추가). 파일 끝에 append:
```typescript
describe("links note/url 편집", () => {
  it("createLink는 note를 저장하고 updateLink로 url·note·제목을 바꾼다", async () => {
    const user = await makeUser(`linknote-${Date.now()}@test.local`);
    const space = await createSpace(user.client, { user_id: user.id, name: "개인" });
    const c = await createCollection(user.client, { user_id: user.id, space_id: space.id, title: "C" });
    const created = await createLink(user.client, {
      user_id: user.id, collection_id: c.id, url: "https://a.com", note: "메모1",
    });
    expect(created.note).toBe("메모1");
    const updated = await updateLink(user.client, created.id, {
      url: "https://b.com", note: "메모2", custom_title: "내 제목",
    });
    expect(updated.url).toBe("https://b.com");
    expect(updated.note).toBe("메모2");
    expect(updated.custom_title).toBe("내 제목");
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm --filter @tablign/core test data`
Expected: FAIL — `Link`/`CreateLinkInput`에 note 없음, `updateLink` patch에 url·note 불가(타입 에러) 또는 런타임 실패.

- [ ] **Step 4: 타입 + updateLink 수정**

`packages/core/src/types.ts`의 `Link` 인터페이스에서 `custom_title` 다음 줄에 추가:
```typescript
  note: string | null;
```

`packages/core/src/data/links.ts` 수정:
- `CreateLinkInput`에 추가:
```typescript
  note?: string | null;
```
- `updateLink`의 patch 타입을 다음으로 교체:
```typescript
  patch: Partial<
    Pick<Link, "title" | "custom_title" | "url" | "favicon_url" | "thumbnail_url" | "note" | "position">
  >,
```

- [ ] **Step 5: 통과 + 전체 + lint**

Run: `pnpm --filter @tablign/core test data` → PASS.
Run: `pnpm --filter @tablign/core test` → 전체 PASS.
Run: `pnpm --filter @tablign/core lint` → tsc PASS.

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/0004_links_note.sql packages/core/src/types.ts packages/core/src/data/links.ts packages/core/src/__tests__/data.test.ts
git commit -m "feat(core): links.note 추가 + updateLink url·note 지원"
```

---

## Task 2: InlineInput defaultValue + LinkCard 편집 모드 (TDD)

**Files:**
- Modify: `packages/ui/src/icons.ts`
- Modify: `packages/ui/src/InlineInput.tsx`
- Modify: `packages/ui/src/LinkCard.tsx`
- Modify: `packages/ui/src/__tests__/LinkCard.test.tsx`

- [ ] **Step 1: 아이콘 추가**

`packages/ui/src/icons.ts`의 export 목록에 `Pencil` 추가(기존 항목 유지):
```typescript
  Pencil,
```

- [ ] **Step 2: InlineInput defaultValue 지원**

`packages/ui/src/InlineInput.tsx`에서 props와 useState를 수정:
```typescript
export interface InlineInputProps {
  placeholder: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  autoFocus?: boolean;
  defaultValue?: string;
}

export function InlineInput({ placeholder, onSubmit, onCancel, autoFocus = true, defaultValue = "" }: InlineInputProps) {
  const [value, setValue] = useState(defaultValue);
```
(나머지 본문 동일)

- [ ] **Step 3: LinkCard 편집 테스트 추가**

`packages/ui/src/__tests__/LinkCard.test.tsx`의 `baseLink`에 `note: null`이 포함되도록 확인(없으면 추가). describe 내부에 테스트 추가:
```tsx
it("onUpdate 미제공이면 편집 버튼이 없다", () => {
  render(<LinkCard link={baseLink} onOpen={() => {}} onDelete={() => {}} />);
  expect(screen.queryByRole("button", { name: "편집" })).toBeNull();
});

it("편집 버튼을 누르면 폼이 열리고 저장 시 onUpdate(id, patch)를 호출한다", () => {
  const onUpdate = vi.fn();
  render(<LinkCard link={baseLink} onOpen={() => {}} onDelete={() => {}} onUpdate={onUpdate} />);
  fireEvent.click(screen.getByRole("button", { name: "편집" }));
  fireEvent.change(screen.getByPlaceholderText("제목"), { target: { value: "새 제목" } });
  fireEvent.change(screen.getByPlaceholderText("URL"), { target: { value: "https://new.com" } });
  fireEvent.change(screen.getByPlaceholderText("메모"), { target: { value: "메모" } });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  expect(onUpdate).toHaveBeenCalledWith("1", {
    custom_title: "새 제목",
    url: "https://new.com",
    note: "메모",
  });
});
```
(상단 import에 `vi`가 이미 있다.)

- [ ] **Step 4: 실패 확인**

Run: `pnpm --filter @tablign/ui test LinkCard`
Expected: FAIL — 편집 버튼/폼 없음.

- [ ] **Step 5: LinkCard 재작성**

Replace `packages/ui/src/LinkCard.tsx`:
```tsx
import { useState } from "react";
import type { Link } from "@tablign/core";
import { Favicon } from "./Favicon";
import { ExternalLink, Pencil, Trash2 } from "./icons";
import { theme } from "./theme";

export interface LinkCardProps {
  link: Link;
  onOpen: (url: string) => void;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, patch: { custom_title: string | null; url: string; note: string | null }) => void;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const actionBtn: React.CSSProperties = {
  border: "none", background: theme.surface2, borderRadius: 6, padding: 4, cursor: "pointer", display: "flex",
};

export function LinkCard({ link, onOpen, onDelete, onUpdate }: LinkCardProps) {
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(link.custom_title ?? "");
  const [url, setUrl] = useState(link.url);
  const [note, setNote] = useState(link.note ?? "");

  const label = link.custom_title ?? link.title ?? domainOf(link.url);

  function save() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    onUpdate?.(link.id, {
      custom_title: title.trim() || null,
      url: trimmedUrl,
      note: note.trim() || null,
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{ background: theme.surface, border: `1px solid ${theme.accent}`, borderRadius: theme.radiusCard, padding: 10, display: "grid", gap: 6 }}
      >
        <input value={title} placeholder="제목" onChange={(e) => setTitle(e.target.value)} style={editInput} />
        <input value={url} placeholder="URL" onChange={(e) => setUrl(e.target.value)} style={editInput} />
        <input value={note} placeholder="메모" onChange={(e) => setNote(e.target.value)} style={editInput} />
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button type="button" onClick={() => setEditing(false)} style={{ ...actionBtn, padding: "5px 10px", color: theme.textMuted }}>취소</button>
          <button type="button" onClick={save} style={{ border: "none", background: theme.accent, color: "#fff", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}>저장</button>
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: "relative", background: theme.surface, border: `1px solid ${theme.borderCard}`, borderRadius: theme.radiusCard, padding: "10px 11px" }}
    >
      <button
        type="button"
        onClick={() => onOpen(link.url)}
        style={{ all: "unset", cursor: "pointer", display: "flex", gap: 8, alignItems: "center", width: "100%" }}
      >
        <Favicon url={link.favicon_url} />
        <span style={{ fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
      </button>
      {link.note ? (
        <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.note}</div>
      ) : (
        label !== domainOf(link.url) && <div style={{ color: theme.textFaint, fontSize: 11, marginTop: 5 }}>{domainOf(link.url)}</div>
      )}
      <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 2, opacity: hover ? 1 : 0, pointerEvents: hover ? "auto" : "none", transition: "opacity .12s" }}>
        <button type="button" aria-label="열기" onClick={() => onOpen(link.url)} style={actionBtn}>
          <ExternalLink size={14} color={theme.textMuted} />
        </button>
        {onUpdate && (
          <button type="button" aria-label="편집" onPointerDown={(e) => e.stopPropagation()} onClick={() => setEditing(true)} style={actionBtn}>
            <Pencil size={14} color={theme.textMuted} />
          </button>
        )}
        <button type="button" aria-label="삭제" onClick={() => onDelete(link.id)} style={actionBtn}>
          <Trash2 size={14} color={theme.danger} />
        </button>
      </div>
    </div>
  );
}

const editInput: React.CSSProperties = {
  width: "100%", padding: "6px 8px", border: `1px solid ${theme.border}`, borderRadius: 6, fontSize: 12, outline: "none", boxSizing: "border-box",
};
```

- [ ] **Step 6: 통과 + lint**

Run: `pnpm --filter @tablign/ui test LinkCard` → 기존 3 + 신규 2 PASS.
Run: `pnpm --filter @tablign/ui lint` → tsc PASS.

- [ ] **Step 7: 커밋**

```bash
git add packages/ui/src/icons.ts packages/ui/src/InlineInput.tsx packages/ui/src/LinkCard.tsx packages/ui/src/__tests__/LinkCard.test.tsx
git commit -m "feat(ui): LinkCard 제목/URL/메모 편집 + InlineInput defaultValue"
```

---

## Task 3: CollectionSection 제목 인라인 편집 + autoEditTitle (TDD)

**Files:**
- Modify: `packages/ui/src/CollectionSection.tsx`
- Modify: `packages/ui/src/__tests__/CollectionSection.test.tsx`

- [ ] **Step 1: 테스트 추가**

`packages/ui/src/__tests__/CollectionSection.test.tsx`에 추가(기존 noop·collection·links 재사용):
```tsx
it("제목 클릭 시 인라인 편집되고 Enter로 onRenameCollection을 호출한다", () => {
  const onRename = vi.fn();
  render(
    <CollectionSection collection={collection} links={links}
      onOpenLink={noop} onDeleteLink={noop} onAddLink={noop} onOpenAll={noop} onDeleteCollection={noop}
      onRenameCollection={onRename} />,
  );
  fireEvent.click(screen.getByText("읽을거리"));
  const input = screen.getByDisplayValue("읽을거리");
  fireEvent.change(input, { target: { value: "새 이름" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onRename).toHaveBeenCalledWith("c1", "새 이름");
});

it("autoEditTitle이면 마운트 시 제목 편집 입력이 보인다", () => {
  render(
    <CollectionSection collection={collection} links={links}
      onOpenLink={noop} onDeleteLink={noop} onAddLink={noop} onOpenAll={noop} onDeleteCollection={noop}
      onRenameCollection={noop} autoEditTitle />,
  );
  expect(screen.getByDisplayValue("읽을거리")).toBeInTheDocument();
});
```
(상단 import에 `vi`가 이미 있다.)

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @tablign/ui test CollectionSection`
Expected: FAIL — `onRenameCollection`/`autoEditTitle` 없음, 제목이 편집되지 않음.

- [ ] **Step 3: 구현**

`packages/ui/src/CollectionSection.tsx`:
- import에 `InlineInput`이 이미 있음. props 인터페이스에 추가:
```typescript
  autoEditTitle?: boolean;
  onRenameCollection?: (id: string, title: string) => void;
```
- 함수 시그니처 구조분해에 `autoEditTitle, onRenameCollection` 추가.
- 상단 상태 추가:
```typescript
  const [editingTitle, setEditingTitle] = useState(!!autoEditTitle);
```
- 헤더의 제목 `<strong>...</strong>`을 다음으로 교체:
```tsx
        {editingTitle && onRenameCollection ? (
          <div style={{ flex: 1 }}>
            <InlineInput
              placeholder="컬렉션 이름"
              defaultValue={collection.title}
              onSubmit={(name) => { onRenameCollection(collection.id, name); setEditingTitle(false); }}
              onCancel={() => setEditingTitle(false)}
            />
          </div>
        ) : (
          <strong
            style={{ color: "#3b3f46", cursor: onRenameCollection ? "text" : "default" }}
            onClick={() => onRenameCollection && setEditingTitle(true)}
          >
            {collection.icon ? `${collection.icon} ` : ""}{collection.title}
          </strong>
        )}
```

- [ ] **Step 4: 통과 + 전체 ui + lint**

Run: `pnpm --filter @tablign/ui test CollectionSection` → PASS.
Run: `pnpm --filter @tablign/ui test` → 전체 PASS.
Run: `pnpm --filter @tablign/ui lint` → tsc PASS.

- [ ] **Step 5: 커밋**

```bash
git add packages/ui/src/CollectionSection.tsx packages/ui/src/__tests__/CollectionSection.test.tsx
git commit -m "feat(ui): CollectionSection 제목 인라인 편집 + autoEditTitle"
```

---

## Task 4: 확장 DndLinkList — 반응형 그리드 + 고스트 미리보기

**Files:**
- Modify (replace): `apps/extension/src/newtab/DndLinkList.tsx`

- [ ] **Step 1: DndLinkList 재작성**

Replace `apps/extension/src/newtab/DndLinkList.tsx`:
```tsx
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { LinkCard, Favicon, theme } from "@tablign/ui";
import type { Link } from "@tablign/core";

export interface DropIndicator {
  collectionId: string;
  beforeLinkId: string | null;
}

export interface DragPreview {
  label: string;
  faviconUrl: string | null;
}

const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 9,
};

function GhostCard({ preview }: { preview: DragPreview }) {
  return (
    <div style={{
      display: "flex", gap: 8, alignItems: "center",
      border: `1.5px dashed ${theme.accent}`, borderRadius: theme.radiusCard,
      padding: "10px 11px", background: theme.accentWeak, color: theme.accent, pointerEvents: "none",
      overflow: "hidden",
    }}>
      <Favicon url={preview.faviconUrl} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview.label}</span>
    </div>
  );
}

function DraggableCard({
  link, collectionId, nextLinkId, onOpen, onDelete, onUpdate,
}: {
  link: Link;
  collectionId: string;
  nextLinkId: string | null;
  onOpen: (url: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: { custom_title: string | null; url: string; note: string | null }) => void;
}) {
  const drag = useDraggable({ id: `link-${link.id}`, data: { kind: "link", link } });
  const drop = useDroppable({ id: `card-${link.id}`, data: { kind: "card", collectionId, linkId: link.id, nextLinkId } });
  return (
    <div ref={drop.setNodeRef}>
      <div ref={drag.setNodeRef} {...drag.listeners} {...drag.attributes} style={{ opacity: drag.isDragging ? 0.4 : 1, cursor: "grab" }}>
        <LinkCard link={link} onOpen={onOpen} onDelete={onDelete} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

export interface DndLinkListProps {
  collectionId: string;
  links: Link[];
  dropIndicator: DropIndicator | null;
  preview: DragPreview | null;
  onOpenLink: (url: string) => void;
  onDeleteLink: (id: string) => void;
  onUpdateLink: (id: string, patch: { custom_title: string | null; url: string; note: string | null }) => void;
}

export function DndLinkList({ collectionId, links, dropIndicator, preview, onOpenLink, onDeleteLink, onUpdateLink }: DndLinkListProps) {
  const end = useDroppable({ id: `end-${collectionId}`, data: { kind: "end", collectionId } });
  const targeting = dropIndicator?.collectionId === collectionId;
  const showGhostBefore = (id: string) => targeting && preview && dropIndicator!.beforeLinkId === id;
  const showGhostEnd = targeting && preview && dropIndicator!.beforeLinkId === null;

  return (
    <div style={GRID}>
      {links.map((l, i) => (
        <div key={l.id} style={{ display: "contents" }}>
          {showGhostBefore(l.id) && <GhostCard preview={preview!} />}
          <DraggableCard
            link={l}
            collectionId={collectionId}
            nextLinkId={links[i + 1]?.id ?? null}
            onOpen={onOpenLink}
            onDelete={onDeleteLink}
            onUpdate={onUpdateLink}
          />
        </div>
      ))}
      {showGhostEnd && <GhostCard preview={preview!} />}
      <div ref={end.setNodeRef} style={{ gridColumn: "1 / -1", minHeight: 22 }} />
    </div>
  );
}
```

- [ ] **Step 2: lint(확장은 NewTab도 함께 봄 — 다음 Task에서 맞춤)**

Run: `pnpm --filter @tablign/extension test` → 기존 테스트(order/tabs/OpenTabsPanel) PASS(이 파일은 직접 테스트 대상 아님).
참고: `pnpm --filter @tablign/extension lint`는 NewTab이 아직 옛 props를 쓰면 실패할 수 있음 — Task 5에서 NewTab을 맞춘 뒤 통과시킨다.

- [ ] **Step 3: 커밋**

```bash
git add apps/extension/src/newtab/DndLinkList.tsx
git commit -m "feat(extension): DndLinkList 반응형 그리드 + 고스트 미리보기"
```

---

## Task 5: 확장 NewTab — 커서 판정 · 즉시생성+자동포커스 · 이름수정 · 카드편집 배선

**Files:**
- Modify: `apps/extension/src/newtab/NewTab.tsx`

- [ ] **Step 1: NewTab 수정**

다음 변경을 적용한다(나머지 구조는 유지):

(a) import에 `updateLink`, `updateCollection`을 `@tablign/core`에서 추가하고, DndLinkList import에 `type DragPreview`를 추가:
```typescript
import { listSpaces, listCollections, listLinks, createLink, createCollection, createSpace, moveLink, updateLink, updateCollection, deleteLink, deleteCollection, type Collection, type Link } from "@tablign/core";
import { DndLinkList, type DropIndicator, type DragPreview } from "./DndLinkList";
```

(b) 새 상태 추가(다른 useState 근처):
```typescript
  const [autoEditId, setAutoEditId] = useState<string | null>(null);
```

(c) `addCollection`을 "즉시 생성 + 자동 포커스"로 교체(인라인 입력 토글 제거):
```typescript
  async function addCollection() {
    if (!session) return;
    const spaces = await listSpaces(supabase);
    let spaceId = spaces[0]?.id;
    if (!spaceId) spaceId = (await createSpace(supabase, { user_id: session.user.id, name: "개인" })).id;
    const created = await createCollection(supabase, { user_id: session.user.id, space_id: spaceId, title: "새 컬렉션" });
    setAutoEditId(created.id);
    await loadCollections();
  }
```

(d) `handleDragMove`를 커서 좌표 기준으로 교체:
```typescript
  function handleDragMove(event: DragMoveEvent) {
    const over = event.over;
    if (!over) { setIndicator(null); return; }
    const od = over.data.current;
    if (od?.kind === "end") {
      setIndicator({ collectionId: od.collectionId as string, beforeLinkId: null });
    } else if (od?.kind === "card") {
      const ae = event.activatorEvent as PointerEvent;
      const cursorX = (ae?.clientX ?? 0) + event.delta.x;
      const centerX = over.rect.left + over.rect.width / 2;
      const before = cursorX < centerX;
      setIndicator({
        collectionId: od.collectionId as string,
        beforeLinkId: before ? (od.linkId as string) : ((od.nextLinkId as string | null) ?? null),
      });
    } else {
      setIndicator(null);
    }
  }
```

(e) 드래그 미리보기 데이터(active → DragPreview) 헬퍼를 컴포넌트 본문에 추가(렌더 직전):
```typescript
  const preview: DragPreview | null = active
    ? active.type === "tab"
      ? { label: active.tab.title ?? active.tab.url ?? "", faviconUrl: active.tab.favIconUrl ?? null }
      : { label: active.link.custom_title ?? active.link.title ?? active.link.url, faviconUrl: active.link.favicon_url }
    : null;
```

(f) 보드의 "+ 컬렉션" 영역을 즉시 생성 버튼으로 단순화(인라인 입력 제거):
```tsx
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: theme.textFaint, fontSize: 12 }}>
              열린 탭을 컬렉션으로 드래그하거나, 새 컬렉션을 추가하세요.
            </span>
            <Button onClick={addCollection}>
              <Plus size={15} /> 컬렉션
            </Button>
          </div>
```
(이에 따라 `addingCollection`/`InlineInput` import·상태는 제거. `InlineInput`을 다른 곳에서 안 쓰면 import에서 삭제.)

(g) 각 `CollectionSection`에 이름수정/자동편집/카드편집을 배선하고, `DndLinkList`에 `preview`와 `onUpdateLink`를 전달:
```tsx
                <CollectionSection
                  key={c.id}
                  collection={c}
                  links={links}
                  isOver={indicator?.collectionId === c.id}
                  autoEditTitle={autoEditId === c.id}
                  onRenameCollection={async (id, title) => { await updateCollection(supabase, id, { title }); setAutoEditId(null); loadCollections(); }}
                  onOpenLink={openUrl}
                  onDeleteLink={async (id) => { await deleteLink(supabase, id); reloadCollection(c.id); }}
                  onAddLink={async (url) => { await createLink(supabase, { user_id: userId, collection_id: c.id, url }); reloadCollection(c.id); }}
                  onOpenAll={() => links.forEach((l) => openUrl(l.url))}
                  onDeleteCollection={async (id) => { await deleteCollection(supabase, id); loadCollections(); }}
                  linksSlot={
                    <DndLinkList
                      collectionId={c.id}
                      links={links}
                      dropIndicator={indicator}
                      preview={preview}
                      onOpenLink={openUrl}
                      onDeleteLink={async (id) => { await deleteLink(supabase, id); reloadCollection(c.id); }}
                      onUpdateLink={async (id, patch) => { await updateLink(supabase, id, patch); reloadCollection(c.id); }}
                    />
                  }
                />
```

(h) import 정리: `DragMoveEvent` 타입이 이미 import되어 있는지 확인(없으면 `type DragMoveEvent` 추가). `InlineInput` 미사용 시 제거.

- [ ] **Step 2: lint + 빌드**

Run: `pnpm --filter @tablign/extension lint` → tsc PASS.
Run: `pnpm --filter @tablign/extension test` → 전체 PASS.
Run: `pnpm --filter @tablign/extension build` → 빌드 성공, dist 산출.

- [ ] **Step 3: 커밋**

```bash
git add apps/extension/src/newtab/NewTab.tsx
git commit -m "feat(extension): 커서 기준 드롭 판정·고스트 미리보기·즉시생성+자동포커스·이름/카드 편집"
```

---

## Task 6: 웹 — useUpdateLink + 카드 편집/이름 수정 연결

**Files:**
- Modify: `apps/web/src/lib/queries.ts`
- Modify: `apps/web/src/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: queries.ts에 updateLink import + 훅 추가**

`@tablign/core` import 목록에 `updateLink`, `updateCollection`이 포함되도록 한다(없으면 추가; 파일에 이미 `moveLink, updateLink`가 re-export될 수 있으니 중복 주의 — 훅 추가만 필요).

`useDeleteLink` 아래에 추가:
```typescript
export function useUpdateLink(collectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; patch: { custom_title: string | null; url: string; note: string | null } }) =>
      updateLink(supabase, args.id, args.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["links", collectionId] }),
  });
}

export function useRenameCollection(spaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; title: string }) => updateCollection(supabase, args.id, { title: args.title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections", spaceId] }),
  });
}
```
`updateLink`/`updateCollection`이 import되어 있는지 확인하고 없으면 `@tablign/core` import에 추가.

- [ ] **Step 2: DashboardClient에서 연결**

`apps/web/src/app/dashboard/DashboardClient.tsx`의 `SectionContainer`에서 훅 추가 및 `CollectionSection`에 props 연결:
```tsx
  const updateLink = useUpdateLink(collection.id);
  // ...
      <CollectionSection
        collection={collection}
        links={links}
        isOver={isOver}
        tagSlot={<TagBar collectionId={collection.id} userId={userId} />}
        onOpenLink={openUrl}
        onDeleteLink={(id) => deleteLink.mutate(id)}
        onUpdateLink={(id, patch) => updateLink.mutate({ id, patch })}
        onAddLink={(url) => { addLink.mutate({ user_id: userId, url }); toast.show("링크를 추가했어요"); }}
        onOpenAll={(_id) => links.forEach((l) => openUrl(l.url))}
        onDeleteCollection={(id) => { deleteCollection.mutate(id); toast.show("컬렉션을 삭제했어요"); }}
        onRenameCollection={(id, title) => renameCollection.mutate({ id, title })}
      />
```
주의: `CollectionSection`의 기본 그리드(`linksSlot` 미사용)는 `onUpdateLink`를 LinkCard로 전달해야 한다. 따라서 `CollectionSection`의 기본 그리드 렌더에서 `<LinkCard ... onUpdate={onUpdateLink} />`로 전달하도록 `packages/ui/src/CollectionSection.tsx`에 `onUpdateLink?` prop을 추가하고 기본 그리드에 연결한다:
```tsx
// props 인터페이스에 추가
  onUpdateLink?: (id: string, patch: { custom_title: string | null; url: string; note: string | null }) => void;
// 구조분해에 onUpdateLink 추가
// 기본 그리드의 LinkCard에 onUpdate={onUpdateLink} 전달
```
그리고 `SectionContainer`에 `renameCollection` 훅:
```tsx
  const renameCollection = useRenameCollection(collection.space_id);
```

- [ ] **Step 3: 빌드**

Run: `pnpm --filter @tablign/web build` → 성공.

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/lib/queries.ts apps/web/src/app/dashboard/DashboardClient.tsx packages/ui/src/CollectionSection.tsx
git commit -m "feat(web): 링크 카드 편집·컬렉션 이름 수정 연결"
```

---

## Task 7: 전체 검증 + 수동 확인

- [ ] **Step 1: 전체 자동 검증**

Run:
```
pnpm --filter @tablign/core test
pnpm --filter @tablign/ui test
pnpm --filter @tablign/web build
pnpm --filter @tablign/extension test
pnpm --filter @tablign/extension lint
pnpm --filter @tablign/extension build
```
Expected: 모두 통과.

- [ ] **Step 2: 수동 검증(사람, 크롬)**

`pnpm --filter @tablign/extension build` 후 `chrome://extensions` 새로고침 → 새 탭에서:
- 열린 탭을 그리드의 **카드 사이로** 드래그 → **고스트 카드가 그 자리에 미리보기**되고, 놓으면 **커서 위치 그대로** 저장(새로고침 불필요).
- 링크 카드 드래그로 순서 변경/다른 컬렉션 이동.
- "+ 컬렉션" 클릭 → 즉시 "새 컬렉션" 생성 + 제목 입력 자동 포커스 → 이름 입력.
- 컬렉션 제목 클릭 → 이름 수정.
- 카드 hover → 연필 → 제목/URL/메모 수정.

- [ ] **Step 3: 커밋(필요 시 없음)** — 검증만.

---

## Self-Review 결과

- **Spec 커버리지:** 위치버그(Task 5 커서판정) · 미리보기(Task 4 고스트) · 그리드(Task 4) · 즉시생성+자동포커스(Task 3 autoEditTitle + Task 5 addCollection) · 이름수정(Task 3 + 5/6) · 카드편집 제목/URL/메모(Task 1 note + Task 2 LinkCard + 5/6) — 모두 커버.
- **타입 일관성:** `onUpdate(id, { custom_title, url, note })` 시그니처가 LinkCard(Task 2) = DndLinkList(Task 4) = NewTab(Task 5) = web(Task 6)에서 동일. `onRenameCollection(id, title)`·`autoEditTitle` CollectionSection(Task 3) = 사용처(5/6) 일치. `updateLink` patch에 url·note 추가(Task 1)와 호출부 일치. `DropIndicator`·`DragPreview` 타입 DndLinkList(Task 4) = NewTab(Task 5) 일치.
- **Placeholder 스캔:** 모든 코드/명령 실제 내용 포함. DnD 실제 동작은 헤드리스 불가라 Task 7 수동 검증으로 명시.
- **주의:** Task 6에서 `CollectionSection` 기본 그리드(웹)가 `onUpdateLink`를 LinkCard로 전달하도록 ui에 `onUpdateLink?` prop 추가가 필요(확장은 linksSlot으로 직접 전달하므로 무관). 이를 Task 6에 포함.

---

## 다음 단계

완료 시 토비 수준의 그리드 보드 + 드롭 미리보기 + 인라인 편집이 갖춰진다. 후속: 웹 링크 드래그 복원, 카드 썸네일 뷰, 다크 모드.
