import { useState, type ReactNode } from "react";
import type { Space } from "@tablign/core";
import { Hash, Plus, Pencil, PanelLeftClose, LogOut, InlineInput, theme } from "@tablign/ui";

export interface ExtSidebarProps {
  spaces: Space[];
  activeSpaceId: string | null;
  userEmail: string;
  onSelectSpace: (id: string) => void;
  onAddSpace: (name: string) => void;
  onRenameSpace: (id: string, name: string) => void;
  onCollapse: () => void;
  onSignOut: () => void;
  searchSlot: ReactNode;
}

export function ExtSidebar({ spaces, activeSpaceId, userEmail, onSelectSpace, onAddSpace, onRenameSpace, onCollapse, onSignOut, searchSlot }: ExtSidebarProps) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  return (
    <>
      <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: theme.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>t</div>
          <strong>tablign</strong>
        </div>
        <button type="button" title="사이드바 접기" aria-label="사이드바 접기" onClick={onCollapse} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
          <PanelLeftClose size={16} color={theme.textFaint} />
        </button>
      </div>

      <div style={{ padding: "11px 12px" }}>{searchSlot}</div>

      <div style={{ padding: "4px 14px", fontSize: 10, letterSpacing: 1, color: theme.textFaint }}>SPACES</div>
      <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        {spaces.map((s) => {
          const active = s.id === activeSpaceId;
          if (editingId === s.id) {
            return (
              <div key={s.id} style={{ padding: "2px 6px" }}>
                <InlineInput
                  placeholder="스페이스 이름"
                  defaultValue={s.name}
                  onSubmit={(name) => { onRenameSpace(s.id, name); setEditingId(null); }}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            );
          }
          return (
            <div key={s.id} onMouseEnter={() => setHoverId(s.id)} onMouseLeave={() => setHoverId(null)} style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <button type="button" onClick={() => onSelectSpace(s.id)}
                style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
                  background: active ? theme.accentWeak : "transparent", color: active ? theme.accent : "#495057", fontWeight: active ? 600 : 400 }}>
                <Hash size={15} /> {s.name}
              </button>
              {hoverId === s.id && (
                <button type="button" title="이름 수정" aria-label="스페이스 이름 수정" onClick={() => setEditingId(s.id)}
                  style={{ position: "absolute", right: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 3 }}>
                  <Pencil size={13} color={theme.textFaint} />
                </button>
              )}
            </div>
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

      <div style={{ marginTop: "auto", padding: "12px 14px", borderTop: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 8, color: theme.textMuted }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#dfe2ea", flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{userEmail || "내 계정"}</span>
        <button type="button" title="로그아웃" aria-label="로그아웃" onClick={onSignOut}
          style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 3, flexShrink: 0 }}>
          <LogOut size={15} color={theme.textFaint} />
        </button>
      </div>
    </>
  );
}
