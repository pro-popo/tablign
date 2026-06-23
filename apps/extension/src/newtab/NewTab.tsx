import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  DndContext, DragOverlay, PointerSensor, pointerWithin, MeasuringStrategy, useSensor, useSensors,
  type CollisionDetection, type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  // 카드(탭/링크) > 컨테이너(컬렉션 container:/창 window:) 순으로 우선.
  const cardHit = hits.find((h) => {
    const id = String(h.id);
    return !id.startsWith("container:") && !id.startsWith("window:");
  });
  return cardHit ? [cardHit] : hits;
};
import { AppShell, Board, CollectionSection, CollectionSkeleton, EmptyState, Button, Favicon, theme, Plus } from "@tablign/ui";
import {
  listSpaces, listCollections, listLinks, createLink, createCollection, createSpace, moveLink, deleteLink, deleteCollection,
  updateLink, updateCollection, updateSpace,
  type Collection, type Link, type Space,
} from "@tablign/core";
import { supabase } from "../lib/supabase";
import { tabsToLinkInputs, tabDropToLinkInput, groupTabsByWindow, moveTab, resolveTabDropTarget, parseTabDragId, type WindowGroup, type WindowTab } from "../lib/tabs";
import { placeInOrder, sequentialPositions } from "../lib/order";
import { usePanelState } from "../lib/usePanelState";
import { useActiveSpace } from "../lib/useActiveSpace";
import { OpenTabsPanel } from "./OpenTabsPanel";
import { ExtSidebar } from "./ExtSidebar";
import { ExtSearchBar } from "./ExtSearchBar";
import { DndLinkList } from "./DndLinkList";
import { AuthScreen } from "./AuthScreen";

interface DragPreview { label: string; faviconUrl: string | null; domain: string }

function openUrl(url: string) { chrome.tabs.create({ url }); }

const NEW_TAB_PLACEHOLDER = "__newtab__";

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

type Active = { type: "tab"; tab: WindowTab } | { type: "link"; link: Link } | null;

export function NewTab() {
  const [session, setSession] = useState<Session | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const { activeSpaceId, setActiveSpaceId, loaded: spaceLoaded } = useActiveSpace();
  const [collections, setCollections] = useState<Collection[]>([]);
  // 첫 컬렉션 로드 완료 전에는 EmptyState 대신 스켈레톤을 보여줘 깜빡임을 막는다.
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);
  const [linksByCol, setLinksByCol] = useState<Record<string, Link[]>>({});
  // 드래그 중 onDragEnd가 최신 상태를 읽도록 ref로 동기 보관(state 배칭 레이스 방지).
  const linksByColRef = useRef<Record<string, Link[]>>({});
  useEffect(() => { linksByColRef.current = linksByCol; }, [linksByCol]);
  // 드래그 시작 시점의 원래 컬렉션(링크 객체의 collection_id가 드래그 중 갱신되므로 시작값을 보관).
  const dragOriginRef = useRef<string | null>(null);
  // 드래그 중 onDragEnd가 최신 groups를 읽도록 ref로 동기 보관.
  const groupsRef = useRef<WindowGroup[]>([]);
  // 드래그 시작 시점의 groups 스냅샷(탭이 컬렉션 위로 돌아오거나 취소될 때 원복용).
  const groupsOriginRef = useRef<WindowGroup[]>([]);
  const [groups, setGroups] = useState<WindowGroup[]>([]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);
  const [active, setActive] = useState<Active>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [autoEditId, setAutoEditId] = useState<string | null>(null);
  const { state: panels, toggleLeft, toggleRight } = usePanelState();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // 스페이스 로드
  // chrome.storage에서 활성 스페이스를 읽은 뒤(spaceLoaded) 실행해, 저장된 스페이스가
  // 아직 존재하면 그대로 유지하고, 없거나 삭제됐으면 첫 스페이스로 폴백한다.
  useEffect(() => {
    if (!session || !spaceLoaded) return;
    (async () => {
      const sp = await listSpaces(supabase);
      setSpaces(sp);
      const keep = activeSpaceId && sp.some((s) => s.id === activeSpaceId);
      setActiveSpaceId(keep ? activeSpaceId : (sp[0]?.id ?? null));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, spaceLoaded]);

  async function loadCollections() {
    if (!activeSpaceId) { setCollections([]); setLinksByCol({}); setCollectionsLoaded(true); return; }
    const cols = await listCollections(supabase, activeSpaceId);
    setCollections(cols);
    const entries = await Promise.all(cols.map(async (c) => [c.id, await listLinks(supabase, c.id)] as const));
    setLinksByCol(Object.fromEntries(entries));
    setCollectionsLoaded(true);
  }
  // 세션/스페이스가 바뀌면 스켈레톤부터 다시 보여준 뒤 로드한다(재조회 핸들러는 플래그를 건드리지 않음).
  useEffect(() => { if (session && activeSpaceId) { setCollectionsLoaded(false); loadCollections(); } /* eslint-disable-next-line */ }, [session, activeSpaceId]);

  async function reloadCollection(collectionId: string) {
    const links = await listLinks(supabase, collectionId);
    setLinksByCol((prev) => ({ ...prev, [collectionId]: links }));
  }

  useEffect(() => {
    if (!session) return;
    (async () => {
      const tabs = await chrome.tabs.query({});
      setGroups(groupTabsByWindow(tabs as WindowTab[]));
    })();
  }, [session]);

  async function addSpace(name: string) {
    if (!session) return;
    const s = await createSpace(supabase, { user_id: session.user.id, name });
    // 새 스페이스에는 기본 컬렉션을 하나 만들어 둔다.
    await createCollection(supabase, { user_id: session.user.id, space_id: s.id, title: "새 컬렉션" });
    setSpaces((prev) => [...prev, s]);
    setActiveSpaceId(s.id);
  }

  async function renameSpace(id: string, name: string) {
    await updateSpace(supabase, id, { name });
    setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }

  async function addCollection() {
    if (!session) return;
    let spaceId = activeSpaceId;
    if (!spaceId) {
      const s = await createSpace(supabase, { user_id: session.user.id, name: "개인" });
      setSpaces((prev) => [...prev, s]);
      setActiveSpaceId(s.id);
      spaceId = s.id;
    }
    const created = await createCollection(supabase, { user_id: session.user.id, space_id: spaceId, title: "새 컬렉션" });
    setAutoEditId(created.id);
    await loadCollections();
  }

  function findContainerIn(map: Record<string, Link[]>, id: string): string | null {
    if (id.startsWith("container:")) return id.slice("container:".length);
    for (const [cid, ls] of Object.entries(map)) {
      if (ls.some((l) => l.id === id)) return cid;
    }
    return null;
  }
  function findContainer(id: string): string | null {
    return findContainerIn(linksByCol, id);
  }

  function handleDragStart(event: DragStartEvent) {
    const d = event.active.data.current;
    if (d?.kind === "link") {
      const link = d.link as Link;
      dragOriginRef.current = link.collection_id; // 시작 시점의 원래 컬렉션
      setActive({ type: "link", link });
    } else if (d?.kind === "tab") {
      dragOriginRef.current = null;
      groupsOriginRef.current = groups;
      setActive({ type: "tab", tab: d.tab as WindowTab });
    } else {
      setActive(null);
    }
  }

  // 드래그 중 순서/컨테이너 이동을 실시간 반영(sortable이 부드럽게 자리 내줌, 위/아래 대칭).
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!session) return;
    if (!over) { setDragOverCol(null); return; }
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
    if (!overC) { setDragOverCol(null); return; }
    setDragOverCol(overC);

    setLinksByCol((prev) => {
      const next = ((): Record<string, Link[]> => {
      const overItems = prev[overC] ?? [];
      const overIdx = overItems.findIndex((l) => l.id === overId);
      const insertIdx = overIdx >= 0 ? overIdx : overItems.length;

      if (d?.kind === "tab") {
        // 탭 자리표시 카드: 이미 같은 컬렉션에 있으면 arrayMove로 위치만 옮긴다(튕김 방지).
        // 컬렉션이 바뀔 때만 제거 후 삽입.
        const curC = findContainerIn(prev, NEW_TAB_PLACEHOLDER);

        if (curC === overC) {
          const items = prev[overC];
          const curIdx = items.findIndex((l) => l.id === NEW_TAB_PLACEHOLDER);
          // over가 자리표시 자신이면 이동 없음
          if (curIdx < 0 || insertIdx < 0 || curIdx === insertIdx || overId === NEW_TAB_PLACEHOLDER) return prev;
          return { ...prev, [overC]: arrayMove(items, curIdx, insertIdx) };
        }

        // 다른(또는 처음) 컬렉션으로: 기존 위치에서 제거 후 새 위치에 삽입
        const tab = d.tab as WindowTab;
        const ph: Link = {
          id: NEW_TAB_PLACEHOLDER, collection_id: overC, user_id: session.user.id,
          url: tab.url ?? "", title: tab.title ?? null, favicon_url: tab.favIconUrl ?? null,
          thumbnail_url: null, custom_title: null, note: null, position: 0, created_at: new Date().toISOString(),
        };
        const next: Record<string, Link[]> = { ...prev };
        if (curC) next[curC] = (prev[curC] ?? []).filter((l) => l.id !== NEW_TAB_PLACEHOLDER);
        const target = (next[overC] ?? []).filter((l) => l.id !== NEW_TAB_PLACEHOLDER);
        let idx = target.findIndex((l) => l.id === overId);
        if (idx < 0) idx = target.length;
        next[overC] = [...target.slice(0, idx), ph, ...target.slice(idx)];
        return next;
      }

      // 링크
      const activeC = findContainer(activeId);
      if (!activeC) return prev;
      const activeItems = prev[activeC] ?? [];
      const oldIdx = activeItems.findIndex((l) => l.id === activeId);
      if (oldIdx < 0) return prev;

      if (activeC === overC) {
        // 같은 컬렉션 내 재정렬(실시간)
        if (oldIdx === insertIdx || insertIdx < 0) return prev;
        return { ...prev, [activeC]: arrayMove(activeItems, oldIdx, insertIdx) };
      }
      // 다른 컬렉션으로 이동(실시간)
      const moving = { ...activeItems[oldIdx], collection_id: overC };
      return {
        ...prev,
        [activeC]: activeItems.filter((l) => l.id !== activeId),
        [overC]: [...overItems.slice(0, insertIdx), moving, ...overItems.slice(insertIdx)],
      };
      })();
      linksByColRef.current = next;
      return next;
    });
  }

  async function persistOrder(orderedIds: string[]) {
    await Promise.all(sequentialPositions(orderedIds).map((p) => updateLink(supabase, p.id, { position: p.position })));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const d = active.data.current;
    const activeId = String(active.id);
    setActive(null);
    setDragOverCol(null);
    if (!over || !session) {
      if (d?.kind === "tab") { setGroups(groupsOriginRef.current); groupsRef.current = groupsOriginRef.current; }
      loadCollections();
      return;
    }

    const map = linksByColRef.current; // 드래그 중 갱신된 최신 상태

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
      // onDragOver에서 이미 실시간으로 순서/컨테이너가 반영됨(ref) → 현재 순서를 그대로 저장.
      const container = findContainerIn(map, activeId);
      if (!container) { loadCollections(); return; }
      const original = dragOriginRef.current; // 드래그 시작 시점의 원래 컬렉션
      const items = map[container] ?? [];
      // 항상 collection_id를 대상 컬렉션으로 확정(드래그 중 링크 객체의 collection_id가 갱신돼
      // 원래 위치 비교가 무력화되므로). 같은 컬렉션이면 사실상 무변경, position은 아래에서 재할당.
      await moveLink(supabase, activeId, container, 0);
      await persistOrder(items.map((l) => l.id));
      reloadCollection(container);
      if (original && original !== container) reloadCollection(original);
    }
  }

  function handleDragCancel() {
    if (active?.type === "tab") { setGroups(groupsOriginRef.current); groupsRef.current = groupsOriginRef.current; }
    setActive(null);
    setDragOverCol(null);
    loadCollections();
  }

  async function saveWindow(windowId: number) {
    if (!session) return;
    let spaceId = activeSpaceId;
    if (!spaceId) {
      const s = await createSpace(supabase, { user_id: session.user.id, name: "개인" });
      setSpaces((prev) => [...prev, s]);
      setActiveSpaceId(s.id);
      spaceId = s.id;
    }
    const idx = groups.findIndex((g) => g.windowId === windowId);
    const group = groups[idx];
    if (!group) return;
    const created = await createCollection(supabase, { user_id: session.user.id, space_id: spaceId, title: `창 ${idx + 1}` });
    const inputs = tabsToLinkInputs(group.tabs, session.user.id, created.id);
    for (const input of inputs) { try { await createLink(supabase, input); } catch (e) { console.error(e); } }
    loadCollections();
  }

  async function closeTab(tabId: number) {
    await chrome.tabs.remove(tabId);
    const tabs = await chrome.tabs.query({});
    setGroups(groupTabsByWindow(tabs as WindowTab[]));
  }

  async function closeWindow(windowId: number) {
    const group = groups.find((g) => g.windowId === windowId);
    const ids = (group?.tabs ?? []).map((t) => t.id).filter((id): id is number => id != null);
    if (ids.length) await chrome.tabs.remove(ids);
    const tabs = await chrome.tabs.query({});
    setGroups(groupTabsByWindow(tabs as WindowTab[]));
  }

  if (!session) {
    return <AuthScreen />;
  }

  const userId = session.user.id;

  // 커서 미리보기(오버레이)용 데이터
  const preview = active
    ? active.type === "tab"
      ? { label: active.tab.title ?? active.tab.url ?? "", faviconUrl: active.tab.favIconUrl ?? null, domain: domainOf(active.tab.url ?? "") }
      : { label: active.link.custom_title ?? active.link.title ?? domainOf(active.link.url), faviconUrl: active.link.favicon_url, domain: domainOf(active.link.url) }
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <AppShell
        leftOpen={panels.left}
        rightOpen={panels.right}
        onToggleLeft={toggleLeft}
        onToggleRight={toggleRight}
        left={
          <ExtSidebar
            spaces={spaces}
            activeSpaceId={activeSpaceId}
            userEmail={session.user.email ?? ""}
            onSelectSpace={(id) => { setActiveSpaceId(id); }}
            onAddSpace={addSpace}
            onRenameSpace={renameSpace}
            onSignOut={async () => { await supabase.auth.signOut(); }}
            onCollapse={toggleLeft}
            searchSlot={<ExtSearchBar />}
          />
        }
        right={
          <OpenTabsPanel groups={groups} onSaveWindow={saveWindow} onCloseWindow={closeWindow} onCloseTab={closeTab} onCollapse={toggleRight} />
        }
      >
        <Board>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <strong style={{ fontSize: 15 }}>{spaces.find((s) => s.id === activeSpaceId)?.name ?? "—"}</strong>
              <span style={{ color: theme.textFaint }}>· {collectionsLoaded ? collections.length : "—"} 컬렉션</span>
            </div>
            <Button onClick={addCollection}>
              <Plus size={15} /> 컬렉션
            </Button>
          </div>
          {(() => {
            const visibleCollections = collections;
            return !collectionsLoaded ? (
              <CollectionSkeleton />
            ) : visibleCollections.length === 0 ? (
              <EmptyState title="컬렉션이 없어요. ‘＋ 컬렉션’으로 영역을 만든 뒤, 열린 탭을 드래그해 넣어보세요." />
            ) : (
              visibleCollections.map((c) => {
              const links = linksByCol[c.id] ?? [];
              return (
                <CollectionSection
                  key={c.id}
                  collection={c}
                  links={links}
                  isOver={dragOverCol === c.id}
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
                      onOpenLink={openUrl}
                      onDeleteLink={async (id) => { await deleteLink(supabase, id); reloadCollection(c.id); }}
                      onUpdateLink={async (id, patch) => { await updateLink(supabase, id, patch); reloadCollection(c.id); }}
                    />
                  }
                />
              );
              })
            );
          })()}
        </Board>
      </AppShell>
      <DragOverlay dropAnimation={null}>
        {preview ? (
          <div style={{
            border: `1px solid ${theme.border}`, borderRadius: theme.radiusCard, padding: "10px 11px",
            background: "#fff", boxShadow: "0 8px 20px rgba(20,30,60,.22)", width: 240, boxSizing: "border-box", cursor: "grabbing",
          }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Favicon url={preview.faviconUrl} />
              <span style={{ fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {preview.label}
              </span>
            </div>
            <div style={{ color: theme.textFaint, fontSize: 11, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {preview.domain}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
