"use client";

import { useEffect, useState } from "react";
import { AppShell, Board, CollectionSection, EmptyState, Button, useToast } from "@tablign/ui";
import type { Collection } from "@tablign/core";
import { useDroppable } from "@dnd-kit/core";
import {
  useSpaces, useCreateSpace, useCollections, useCreateCollection, useDeleteCollection,
  useLinks, useAddLink, useDeleteLink, useTags, useCollectionIdsForTag,
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
        onOpenAll={(_id) => links.forEach((l) => openUrl(l.url))}
        onDeleteCollection={(id) => { deleteCollection.mutate(id); toast.show("컬렉션을 삭제했어요"); }}
      />
    </div>
  );
}

export function DashboardClient({ userId }: { userId: string; userEmail: string }) {
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
          <EmptyState title="아직 컬렉션이 없어요. 상단 '＋ 컬렉션'으로 시작하세요." />
        ) : (
          visible.map((c) => <SectionContainer key={c.id} collection={c} userId={userId} />)
        )}
      </Board>
    </AppShell>
  );
}
