import { useState, type ReactNode } from "react";
import type { Space } from "@tablign/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Hash, Plus, Pencil, PanelLeftClose, LogOut, InlineInput, theme, Logo } from "@tablign/ui";

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

/** 스페이스 행을 드래그로 재정렬할 수 있게 감싸는 sortable 래퍼.
 *  선택 버튼을 드래그 activator로 쓴다. distance:5 제약 덕에 클릭=선택, 5px 이상 이동=재정렬. */
function SortableSpace({ space, active, onSelect, onStartEdit }: {
  space: Space;
  active: boolean;
  onSelect: () => void;
  onStartEdit: () => void;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: `space:${space.id}`,
    data: { kind: "space", space },
  });
  const [hover, setHover] = useState(false);
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    display: "flex",
    alignItems: "center",
  };
  return (
    <div ref={setNodeRef} style={style} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} onClick={onSelect}
        style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
          background: active ? theme.accentWeak : "transparent", color: active ? theme.accent : "#495057", fontWeight: active ? 600 : 400 }}>
        <Hash size={15} /> {space.name}
      </button>
      {hover && (
        <button type="button" title="이름 수정" aria-label="스페이스 이름 수정" onClick={onStartEdit}
          style={{ position: "absolute", right: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 3 }}>
          <Pencil size={13} color={theme.textFaint} />
        </button>
      )}
    </div>
  );
}

export function ExtSidebar({ spaces, activeSpaceId, userEmail, onSelectSpace, onAddSpace, onRenameSpace, onCollapse, onSignOut, searchSlot }: ExtSidebarProps) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  return (
    <>
      <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}` }}>
        <Logo size={24} />
        <button type="button" title="사이드바 접기" aria-label="사이드바 접기" onClick={onCollapse} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
          <PanelLeftClose size={16} color={theme.textFaint} />
        </button>
      </div>

      <div style={{ padding: "11px 12px" }}>{searchSlot}</div>

      <div style={{ padding: "4px 14px", fontSize: 10, letterSpacing: 1, color: theme.textFaint }}>SPACES</div>
      <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        <SortableContext items={spaces.map((s) => `space:${s.id}`)} strategy={verticalListSortingStrategy}>
          {spaces.map((s) =>
            editingId === s.id ? (
              <div key={s.id} style={{ padding: "2px 6px" }}>
                <InlineInput
                  variant="line"
                  placeholder="스페이스 이름"
                  defaultValue={s.name}
                  onSubmit={(name) => { onRenameSpace(s.id, name); setEditingId(null); }}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <SortableSpace
                key={s.id}
                space={s}
                active={s.id === activeSpaceId}
                onSelect={() => onSelectSpace(s.id)}
                onStartEdit={() => setEditingId(s.id)}
              />
            ),
          )}
        </SortableContext>
        {adding ? (
          <div style={{ padding: "2px 6px" }}>
            <InlineInput variant="line" placeholder="스페이스 이름" onSubmit={(v) => { onAddSpace(v); setAdding(false); }} onCancel={() => setAdding(false)} />
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
