"use client";

import { useEffect, useState } from "react";
import { useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { Board, Sidebar, LinkCard, AddLinkInput } from "@tablign/ui";
import type { Collection, Link } from "@tablign/core";
import { positionBetween } from "@tablign/core";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSpaces,
  useCreateSpace,
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  useLinks,
  useAddLink,
  moveLink,
  supabase,
} from "@/lib/queries";
import { BoardDnd } from "./BoardDnd";
import { SearchBar } from "./SearchBar";
import { useRealtimeSync } from "@/lib/useRealtimeSync";

function openUrl(url: string) {
  window.open(url, "_blank", "noopener");
}

function DraggableLink({ link }: { link: Link }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: link.id,
    data: { link },
  });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 1 }
    : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <LinkCard link={link} onOpen={openUrl} />
    </div>
  );
}

function CollectionColumnContainer({
  collection,
  userId,
  onDelete,
}: {
  collection: Collection;
  userId: string;
  onDelete: (id: string) => void;
}) {
  const { data: links = [] } = useLinks(collection.id);
  const addLink = useAddLink(collection.id);
  const { setNodeRef, isOver } = useDroppable({
    id: collection.id,
    data: { collectionId: collection.id },
  });

  return (
    <section
      ref={setNodeRef}
      style={{
        width: 260,
        flexShrink: 0,
        background: isOver ? "#eef3ff" : "#f7f8fa",
        borderRadius: 10,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{collection.icon ? `${collection.icon} ` : ""}{collection.title}</strong>
        <span style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => links.forEach((l) => openUrl(l.url))} title="모두 열기">↗</button>
          <button type="button" onClick={() => onDelete(collection.id)} title="삭제">✕</button>
        </span>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {links.map((link) => (
          <DraggableLink key={link.id} link={link} />
        ))}
      </div>
      <AddLinkInput onAdd={(url) => addLink.mutate({ user_id: userId, url })} />
    </section>
  );
}

export function DashboardClient({ userId, userEmail }: { userId: string; userEmail: string }) {
  useRealtimeSync();
  const { data: spaces = [] } = useSpaces();
  const createSpace = useCreateSpace();
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSpaceId && spaces.length > 0) setActiveSpaceId(spaces[0].id);
  }, [spaces, activeSpaceId]);

  const { data: collections = [] } = useCollections(activeSpaceId);
  const createCollection = useCreateCollection(activeSpaceId);
  const deleteCollection = useDeleteCollection(activeSpaceId);

  const qc = useQueryClient();

  async function handleDragEnd(event: DragEndEvent) {
    const link = event.active.data.current?.link as Link | undefined;
    const targetCollectionId = event.over?.data.current?.collectionId as string | undefined;
    if (!link || !targetCollectionId) return;

    const targetLinks = qc.getQueryData<Link[]>(["links", targetCollectionId]) ?? [];
    const last = targetLinks.filter((l) => l.id !== link.id).at(-1);
    const newPos = positionBetween(last?.position, undefined);

    try {
      // 현재는 대상 컬렉션의 맨 뒤로만 이동한다(컬럼 내 임의 위치 재정렬은 향후 plan에서).
      await moveLink(supabase, link.id, targetCollectionId, newPos);
    } catch (err) {
      console.error("링크 이동 실패", err);
    } finally {
      qc.invalidateQueries({ queryKey: ["links", link.collection_id] });
      qc.invalidateQueries({ queryKey: ["links", targetCollectionId] });
    }
  }

  return (
    <div style={{ display: "flex" }}>
      <Sidebar
        spaces={spaces}
        activeSpaceId={activeSpaceId}
        onSelectSpace={setActiveSpaceId}
        onAddSpace={() => {
          const name = prompt("새 스페이스 이름");
          if (name) createSpace.mutate({ user_id: userId, name });
        }}
      />
      <main style={{ flex: 1 }}>
        <header style={{ display: "flex", justifyContent: "space-between", padding: 16 }}>
          <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span>{userEmail}</span>
            <SearchBar />
          </span>
          <span style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                if (!activeSpaceId) return;
                const title = prompt("새 컬렉션 제목");
                if (title) createCollection.mutate({ user_id: userId, space_id: activeSpaceId, title });
              }}
            >
              + 컬렉션
            </button>
            <form action="/auth/signout" method="post">
              <button type="submit">로그아웃</button>
            </form>
          </span>
        </header>
        <BoardDnd onDragEnd={handleDragEnd}>
          <Board>
            {collections.map((c) => (
              <CollectionColumnContainer
                key={c.id}
                collection={c}
                userId={userId}
                onDelete={(id) => deleteCollection.mutate(id)}
              />
            ))}
          </Board>
        </BoardDnd>
      </main>
    </div>
  );
}
