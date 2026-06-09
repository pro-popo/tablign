import { useState, type ReactNode } from "react";
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
  tagSlot?: ReactNode;
  /** 제공되면 기본 링크 그리드 대신 이 노드를 렌더(확장의 DnD 리스트 주입용) */
  linksSlot?: ReactNode;
  onOpenLink: (url: string) => void;
  onDeleteLink: (id: string) => void;
  onAddLink: (url: string) => void;
  onOpenAll: (collectionId: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  autoEditTitle?: boolean;
  onRenameCollection?: (id: string, title: string) => void;
  onUpdateLink?: (id: string, patch: { custom_title: string | null; url: string; note: string | null }) => void;
}

export function CollectionSection({
  collection, links, collapsed: collapsedProp, isOver, tagSlot, linksSlot,
  onOpenLink, onDeleteLink, onAddLink, onOpenAll, onDeleteCollection,
  autoEditTitle, onRenameCollection, onUpdateLink,
}: CollectionSectionProps) {
  const [collapsed, setCollapsed] = useState(!!collapsedProp);
  const [adding, setAdding] = useState(false);
  const [editingTitle, setEditingTitle] = useState(!!autoEditTitle);

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
          title={collapsed ? "섹션 펼치기" : "섹션 접기"}
          aria-label={collapsed ? "섹션 펼치기" : "섹션 접기"}
          onClick={() => setCollapsed((c) => !c)}
          style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 2 }}
        >
          {collapsed ? <ChevronRight size={16} color={theme.textMuted} /> : <ChevronDown size={16} color={theme.textMuted} />}
        </button>
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
        <span style={{ color: theme.textFaint, fontSize: 12 }}>{links.length}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
          <button type="button" title="링크 추가" aria-label="링크 추가" onClick={() => setAdding(true)} style={iconBtn}>
            <Plus size={15} color={theme.textMuted} />
          </button>
          <button type="button" title="모두 열기" aria-label="모두 열기" onClick={() => onOpenAll(collection.id)} style={iconBtn}>
            <ExternalLink size={15} color={theme.textMuted} />
          </button>
          <button type="button" title="컬렉션 삭제" aria-label="컬렉션 삭제" onClick={() => onDeleteCollection(collection.id)} style={iconBtn}>
            <Trash2 size={15} color={theme.danger} />
          </button>
        </span>
      </header>
      {!collapsed && (
        <>
          {tagSlot && <div style={{ marginBottom: 8 }}>{tagSlot}</div>}
          {adding && (
            <div style={{ marginBottom: 8 }}>
              <InlineInput
                placeholder="URL 붙여넣기"
                onSubmit={(url) => { onAddLink(url); setAdding(false); }}
                onCancel={() => setAdding(false)}
              />
            </div>
          )}
          {linksSlot ?? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 9 }}>
              {links.map((link) => (
                <LinkCard key={link.id} link={link} onOpen={onOpenLink} onDelete={onDeleteLink} onUpdate={onUpdateLink} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

const iconBtn: React.CSSProperties = {
  border: "none", background: "none", cursor: "pointer", display: "flex", padding: 3, borderRadius: 6,
};
