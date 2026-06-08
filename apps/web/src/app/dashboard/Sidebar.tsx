"use client";

import { useState } from "react";
import type { Space, Tag } from "@tablign/core";
import { Hash, Plus, PanelLeftClose, theme, InlineInput } from "@tablign/ui";

export interface SidebarProps {
  spaces: Space[];
  tags: Tag[];
  activeSpaceId: string | null;
  activeTagId: string | null;
  onSelectSpace: (id: string) => void;
  onToggleTag: (id: string) => void;
  onAddSpace: (name: string) => void;
  onCollapse: () => void;
  searchSlot: React.ReactNode;
}

export function Sidebar({
  spaces, tags, activeSpaceId, activeTagId,
  onSelectSpace, onToggleTag, onAddSpace, onCollapse, searchSlot,
}: SidebarProps) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: theme.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>t</div>
          <strong>tablign</strong>
        </div>
        <button type="button" aria-label="사이드바 접기" onClick={onCollapse} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
          <PanelLeftClose size={16} color={theme.textFaint} />
        </button>
      </div>
      <div style={{ padding: "11px 12px" }}>{searchSlot}</div>
      <div style={{ padding: "4px 14px", fontSize: 10, letterSpacing: 1, color: theme.textFaint }}>SPACES</div>
      <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        {spaces.map((s) => {
          const active = s.id === activeSpaceId;
          return (
            <button key={s.id} type="button" onClick={() => onSelectSpace(s.id)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                background: active ? theme.accentWeak : "transparent", color: active ? theme.accent : "#495057", fontWeight: active ? 600 : 400, textAlign: "left" }}>
              <Hash size={15} /> {s.name}
            </button>
          );
        })}
        {adding ? (
          <div style={{ padding: "2px 6px" }}>
            <InlineInput placeholder="스페이스 이름" onSubmit={(v) => { onAddSpace(v); setAdding(false); }} onCancel={() => setAdding(false)} />
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", color: theme.textFaint }}>
            <Plus size={15} /> 스페이스 추가
          </button>
        )}
      </div>
      {tags.length > 0 && (
        <>
          <div style={{ padding: "12px 14px 4px", fontSize: 10, letterSpacing: 1, color: theme.textFaint }}>TAGS</div>
          <div style={{ padding: "0 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {tags.map((t) => {
              const active = t.id === activeTagId;
              return (
                <button key={t.id} type="button" onClick={() => onToggleTag(t.id)}
                  style={{ fontSize: 11, borderRadius: theme.radiusChip, padding: "3px 9px", cursor: "pointer",
                    border: `1px solid ${active ? theme.accent : theme.border}`, background: active ? theme.accent : "#fff", color: active ? "#fff" : "#5c636b" }}>
                  #{t.name}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
