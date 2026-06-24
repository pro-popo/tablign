import { useState } from "react";
import type { Link } from "@tablign/core";
import { Favicon } from "./Favicon";
import { Pencil, Trash2 } from "./icons";
import { theme } from "./theme";

export interface LinkCardProps {
  link: Link;
  onOpen: (url: string) => void;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, patch: { custom_title: string | null; url: string; note: string | null }) => void;
  /** 드래그가 진행 중이면 hover 액션 아이콘을 숨긴다 */
  dragging?: boolean;
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
const editInput: React.CSSProperties = {
  width: "100%", padding: "6px 8px", border: `1px solid ${theme.border}`, borderRadius: 6, fontSize: 12, outline: "none", boxSizing: "border-box",
};

export function LinkCard({ link, onOpen, onDelete, onUpdate, dragging }: LinkCardProps) {
  const [hover, setHover] = useState(false);
  const showActions = hover && !dragging;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(link.custom_title ?? link.title ?? "");
  const [url, setUrl] = useState(link.url);
  const [note, setNote] = useState(link.note ?? "");

  const label = link.custom_title ?? link.title ?? domainOf(link.url);

  function openEdit() {
    // 편집 열 때마다 현재 값으로 채운다.
    setTitle(link.custom_title ?? link.title ?? "");
    setUrl(link.url);
    setNote(link.note ?? "");
    setEditing(true);
  }

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
      onClick={() => onOpen(link.url)}
      style={{ position: "relative", background: theme.surface, border: `1px solid ${theme.borderCard}`, borderRadius: theme.radiusCard, padding: "10px 11px", cursor: "pointer" }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
        <Favicon url={link.favicon_url} />
        <span style={{ fontWeight: 600, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
      </div>
      {(() => {
        // 부제는 항상 한 줄로 고정(카드 높이 통일). "메모 | 주소" 형태(메모 없으면 주소만).
        const dom = domainOf(link.url);
        const showDom = label !== dom;
        const sub = link.note ? `${link.note} · ${dom}` : showDom ? dom : "";
        return (
          <div style={{ color: theme.textFaint, fontSize: 11, marginTop: 5, height: 14, lineHeight: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sub}
          </div>
        );
      })()}
      <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 2, opacity: showActions ? 1 : 0, pointerEvents: showActions ? "auto" : "none", transition: "opacity .12s" }}>
        {onUpdate && (
          <button type="button" title="편집" aria-label="편집" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); openEdit(); }} style={actionBtn}>
            <Pencil size={14} color={theme.textMuted} />
          </button>
        )}
        <button type="button" title="삭제" aria-label="삭제" onClick={(e) => { e.stopPropagation(); onDelete(link.id); }} style={actionBtn}>
          <Trash2 size={14} color={theme.danger} />
        </button>
      </div>
    </div>
  );
}
