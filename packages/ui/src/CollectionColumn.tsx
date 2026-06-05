import type { Collection, Link } from "@tablign/core";
import { LinkCard } from "./LinkCard";
import { AddLinkInput } from "./AddLinkInput";

export interface CollectionColumnProps {
  collection: Collection;
  links: Link[];
  onOpenLink: (url: string) => void;
  onAddLink: (url: string) => void;
  onOpenAll: (collectionId: string) => void;
  onDeleteCollection: (collectionId: string) => void;
}

export function CollectionColumn({
  collection,
  links,
  onOpenLink,
  onAddLink,
  onOpenAll,
  onDeleteCollection,
}: CollectionColumnProps) {
  return (
    <section
      style={{
        width: 260,
        flexShrink: 0,
        background: "#f7f8fa",
        borderRadius: 10,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>
          {collection.icon ? `${collection.icon} ` : ""}
          {collection.title}
        </strong>
        <span style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => onOpenAll(collection.id)} title="모두 열기">
            ↗
          </button>
          <button type="button" onClick={() => onDeleteCollection(collection.id)} title="삭제">
            ✕
          </button>
        </span>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {links.map((link) => (
          <LinkCard key={link.id} link={link} onOpen={onOpenLink} />
        ))}
      </div>
      <AddLinkInput onAdd={onAddLink} />
    </section>
  );
}
