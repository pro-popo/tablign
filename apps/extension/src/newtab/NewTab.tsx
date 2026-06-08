import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { DndContext, PointerSensor, useSensor, useSensors, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { AppShell, Board, CollectionSection, EmptyState, theme, Hash } from "@tablign/ui";
import {
  listSpaces, listCollections, listLinks, createLink, createCollection, deleteLink, deleteCollection,
  type Collection, type Link,
} from "@tablign/core";
import { supabase } from "../lib/supabase";
import { tabsToLinkInputs, groupTabsByWindow, type WindowGroup, type WindowTab } from "../lib/tabs";
import { usePanelState } from "../lib/usePanelState";
import { OpenTabsPanel } from "./OpenTabsPanel";

function openUrl(url: string) { chrome.tabs.create({ url }); }

function SectionContainer({ collection, userId, bump }: { collection: Collection; userId: string; bump: () => void }) {
  const [links, setLinks] = useState<Link[]>([]);
  const { setNodeRef, isOver } = useDroppable({ id: collection.id, data: { collectionId: collection.id } });

  async function reload() { setLinks(await listLinks(supabase, collection.id)); }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [collection.id]);

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
        onDeleteCollection={async (id) => { await deleteCollection(supabase, id); bump(); }}
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

  useEffect(() => {
    if (!session) return;
    (async () => {
      const spaces = await listSpaces(supabase);
      setCollections(spaces[0] ? await listCollections(supabase, spaces[0].id) : []);
    })();
  }, [session, reloadKey]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const tabs = await chrome.tabs.query({});
      setGroups(groupTabsByWindow(tabs as WindowTab[]));
    })();
  }, [session]);

  async function handleDragEnd(event: DragEndEvent) {
    const tab = event.active.data.current?.tab as WindowTab | undefined;
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
    const spaceId = spaces[0]?.id;
    if (!spaceId) return;
    const idx = groups.findIndex((g) => g.windowId === windowId);
    const group = groups[idx];
    if (!group) return;
    const created = await createCollection(supabase, { user_id: session.user.id, space_id: spaceId, title: `창 ${idx + 1}` });
    const inputs = tabsToLinkInputs(group.tabs, session.user.id, created.id);
    for (const input of inputs) { try { await createLink(supabase, input); } catch (e) { console.error(e); } }
    setReloadKey((k) => k + 1);
  }

  async function closeTab(tabId: number) {
    await chrome.tabs.remove(tabId);
    const tabs = await chrome.tabs.query({});
    setGroups(groupTabsByWindow(tabs as WindowTab[]));
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
            collections.map((c) => <SectionContainer key={c.id} collection={c} userId={session.user.id} bump={() => setReloadKey((k) => k + 1)} />)
          )}
        </Board>
      </AppShell>
    </DndContext>
  );
}
