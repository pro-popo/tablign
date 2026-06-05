"use client";

import { useEffect, useState } from "react";
import { Board, Sidebar, CollectionColumn } from "@tablign/ui";
import type { Collection } from "@tablign/core";
import {
  useSpaces,
  useCreateSpace,
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  useLinks,
  useAddLink,
} from "@/lib/queries";

function openUrl(url: string) {
  window.open(url, "_blank", "noopener");
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
  return (
    <CollectionColumn
      collection={collection}
      links={links}
      onOpenLink={openUrl}
      onAddLink={(url) => addLink.mutate({ user_id: userId, url })}
      onOpenAll={() => links.forEach((l) => openUrl(l.url))}
      onDeleteCollection={onDelete}
    />
  );
}

export function DashboardClient({ userId, userEmail }: { userId: string; userEmail: string }) {
  const { data: spaces = [] } = useSpaces();
  const createSpace = useCreateSpace();
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSpaceId && spaces.length > 0) setActiveSpaceId(spaces[0].id);
  }, [spaces, activeSpaceId]);

  const { data: collections = [] } = useCollections(activeSpaceId);
  const createCollection = useCreateCollection(activeSpaceId);
  const deleteCollection = useDeleteCollection(activeSpaceId);

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
          <span>{userEmail}</span>
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
      </main>
    </div>
  );
}
