"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell, Board, CollectionSection, EmptyState, useToast } from "@tablign/ui";
import type { Collection } from "@tablign/core";
import { useDroppable } from "@dnd-kit/core";
import {
  useSpaces, useCreateSpace, useCollections, useCreateCollection, useDeleteCollection,
  useLinks, useAddLink, useDeleteLink, useUpdateLink, useRenameCollection, useTags, useCollectionIdsForTag,
} from "@/lib/queries";
import { usePanelState } from "@/lib/usePanelState";
import { useRealtimeSync } from "@/lib/useRealtimeSync";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { SearchBar } from "./SearchBar";
import { TagBar } from "./TagBar";

function openUrl(url: string) {
  window.open(url, "_blank", "noopener");
}

function SectionContainer({ collection, userId }: { collection: Collection; userId: string }) {
  const { data: links = [] } = useLinks(collection.id);
  const addLink = useAddLink(collection.id);
  const deleteLink = useDeleteLink(collection.id);
  const updateLink = useUpdateLink(collection.id);
  const renameCollection = useRenameCollection(collection.space_id);
  const deleteCollection = useDeleteCollection(collection.space_id);
  const toast = useToast();
  const { setNodeRef, isOver } = useDroppable({ id: collection.id, data: { collectionId: collection.id } });

  return (
    <div ref={setNodeRef}>
      <CollectionSection
        collection={collection}
        links={links}
        isOver={isOver}
        tagSlot={<TagBar collectionId={collection.id} userId={userId} />}
        onOpenLink={openUrl}
        onDeleteLink={(id) => deleteLink.mutate(id)}
        onAddLink={(url) => { addLink.mutate({ user_id: userId, url }); toast.show("링크를 추가했어요"); }}
        onOpenAll={(_id) => links.forEach((l) => openUrl(l.url))}
        onDeleteCollection={(id) => { deleteCollection.mutate(id); toast.show("컬렉션을 삭제했어요"); }}
        onUpdateLink={(id, patch) => updateLink.mutate({ id, patch })}
        onRenameCollection={(id, title) => renameCollection.mutate({ id, title })}
      />
    </div>
  );
}

export function DashboardClient({ userId }: { userId: string; userEmail: string }) {
  const { data: spaces = [] } = useSpaces();
  const { data: tags = [] } = useTags();
  const createSpace = useCreateSpace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const { state: panels, toggleLeft, toggleRight } = usePanelState();
  const toast = useToast();
  useRealtimeSync();

  // 활성 스페이스는 URL(?space=<id>)을 단일 출처로 파생한다.
  // 파라미터가 없거나 더는 존재하지 않는 id면 첫 스페이스로 폴백한다.
  const spaceParam = searchParams.get("space");
  const activeSpaceId =
    (spaceParam && spaces.some((s) => s.id === spaceParam) ? spaceParam : spaces[0]?.id) ?? null;
  const selectSpace = (id: string) => router.replace(`/dashboard?space=${id}`);

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
          onSelectSpace={selectSpace}
          onToggleTag={(id) => setActiveTagId((cur) => (cur === id ? null : id))}
          onAddSpace={(name) => { createSpace.mutate({ user_id: userId, name }); toast.show("스페이스를 추가했어요"); }}
          onCollapse={toggleLeft}
          searchSlot={<SearchBar />}
        />
      }
    >
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
