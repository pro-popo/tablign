import { useState, type ReactNode } from "react";
import type { Space } from "@tablign/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Hash, Plus, Pencil, Trash2, PanelLeftClose, LogOut, InlineInput, ConfirmDialog, theme, Download } from "@tablign/ui";

export interface ExtSidebarProps {
  spaces: Space[];
  sharedSpaces: Space[];
  activeSpaceId: string | null;
  onSelectSpace: (id: string) => void;
  onAddSpace: (name: string) => void;
  onRenameSpace: (id: string, name: string) => void;
  onDeleteSpace: (id: string) => void;
  onLeaveSpace: (id: string) => void;
  onCollapse: () => void;
  onImportCode: () => void;
  searchSlot: ReactNode;
}

/** 스페이스 행을 드래그로 재정렬할 수 있게 감싸는 sortable 래퍼.
 *  선택 버튼을 드래그 activator로 쓴다. distance:5 제약 덕에 클릭=선택, 5px 이상 이동=재정렬. */
function SortableSpace({ space, active, onSelect, onStartEdit, onDelete }: {
  space: Space;
  active: boolean;
  onSelect: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
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
        <div style={{ position: "absolute", right: 6, display: "flex", alignItems: "center", gap: 2 }}>
          <button type="button" title="이름 수정" aria-label="스페이스 이름 수정" onClick={onStartEdit}
            style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 3 }}>
            <Pencil size={13} color={theme.textFaint} />
          </button>
          <button type="button" title="스페이스 삭제" aria-label="스페이스 삭제" onClick={onDelete}
            style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 3 }}>
            <Trash2 size={13} color={theme.textFaint} />
          </button>
        </div>
      )}
    </div>
  );
}

export function ExtSidebar({ spaces, sharedSpaces, activeSpaceId, onSelectSpace, onAddSpace, onRenameSpace, onDeleteSpace, onLeaveSpace, onCollapse, onImportCode, searchSlot }: ExtSidebarProps) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Space | null>(null);
  return (
    <>
      <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "flex-end", borderBottom: `1px solid ${theme.border}` }}>
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
                onDelete={() => setPendingDelete(s)}
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

      {sharedSpaces.length > 0 && (
        <>
          <div style={{ padding: "8px 14px 4px", fontSize: 10, letterSpacing: 1, color: theme.textFaint }}>공유됨</div>
          {/* 정렬 미구현: 공유됨 섹션은 position 순 표시. DnD는 후속 태스크에서 추가 예정. */}
          <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 2 }}>
            {sharedSpaces.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
                <button type="button" onClick={() => onSelectSpace(s.id)}
                  style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
                    background: s.id === activeSpaceId ? theme.accentWeak : "transparent", color: s.id === activeSpaceId ? theme.accent : "#495057", fontWeight: s.id === activeSpaceId ? 600 : 400 }}>
                  <Hash size={15} /> {s.name}
                </button>
                <button type="button" title="나가기" aria-label="스페이스 나가기" onClick={() => onLeaveSpace(s.id)}
                  style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 3 }}>
                  <LogOut size={13} color={theme.textFaint} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ padding: "0 8px", marginTop: "auto" }}>
        <button
          type="button"
          title="코드로 가져오기"
          aria-label="코드로 가져오기"
          onClick={onImportCode}
          style={{
            display: "flex", alignItems: "center", gap: 7, width: "100%",
            border: "none", background: "none", cursor: "pointer",
            padding: "7px 9px", borderRadius: 8, fontSize: 12.5, color: theme.textMuted,
          }}
        >
          <Download size={14} /> 코드로 가져오기
        </button>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        danger
        title="스페이스 삭제"
        message={<>'{pendingDelete?.name}' 스페이스를 삭제할까요?<br />연관된 컬렉션과 탭 모두 삭제되며 되돌릴 수 없습니다.</>}
        confirmLabel="삭제"
        onConfirm={() => { if (pendingDelete) onDeleteSpace(pendingDelete.id); setPendingDelete(null); }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
