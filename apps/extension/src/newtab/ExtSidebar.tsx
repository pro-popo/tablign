import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Space } from "@tablign/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Pencil, Trash2, PanelLeftClose, LogOut, ConfirmDialog, overlayAnimationCss, popIn, theme } from "@tablign/ui";
import { TossEmojiPicker } from "./TossEmojiPicker";
import { ORG_ICON_FONT } from "./orgIcon";

export interface ExtSidebarProps {
  spaces: Space[];
  sharedSpaces: Space[];
  activeSpaceId: string | null;
  onSelectSpace: (id: string) => void;
  onAddSpace: (name: string, icon: string | null) => void;
  onEditSpace: (id: string, name: string, icon: string | null) => void;
  onDeleteSpace: (id: string) => void;
  onLeaveSpace: (id: string) => void;
  onCollapse: () => void;
  searchSlot: ReactNode;
  orgHeaderSlot?: ReactNode;
}

/** 스페이스 아이콘. 고르지 않은 스페이스는 흐린 폴더로 표시한다. */
function SpaceIcon({ icon }: { icon: string | null }) {
  return (
    <span style={{ width: 18, flex: "none", textAlign: "center", fontFamily: ORG_ICON_FONT, fontSize: 15, lineHeight: "18px", opacity: icon ? 1 : 0.45 }}>
      {icon ?? "📁"}
    </span>
  );
}

/** 토스 이모지 피커 크기(px). 아래 공간이 모자라면 위로 뒤집을 때 쓴다. */
const PICKER_W = 376;
const PICKER_H = 430;

/** 앵커 아래(공간이 모자라면 위)에 토스 이모지 피커를 띄운다. 바깥 클릭·Esc로 닫힌다.
 *  사이드바 패널은 overflow:hidden이라 body로 포털해 fixed로 띄운다. */
function EmojiPopover({ anchor, onPick, onClose }: {
  anchor: HTMLElement;
  /** null = '기본 아이콘으로' */
  onPick: (icon: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos] = useState(() => {
    const r = anchor.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < PICKER_H && r.top > below;
    // 위아래 어느 쪽도 다 들어가지 않는 낮은 창에서는 화면 안으로 밀어 넣는다.
    const top = Math.max(8, Math.min(up ? r.top - 6 - PICKER_H : r.bottom + 6, window.innerHeight - PICKER_H - 8));
    return { left: Math.max(8, Math.min(r.left, window.innerWidth - PICKER_W - 8)), top, up };
  });

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor.contains(t)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      data-emoji-popover
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        onClose();
      }}
      style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 1000, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
        boxShadow: "0 16px 40px rgba(0,0,0,.22)", overflow: "hidden", animation: popIn, transformOrigin: pos.up ? "13px 100%" : "13px 0" }}
    >
      <style>{overlayAnimationCss}</style>
      <TossEmojiPicker onSelect={onPick} onClear={() => onPick(null)} />
    </div>,
    document.body,
  );
}

/** 스페이스 추가·수정 입력 행 — 아이콘 버튼 + 이름 입력. 아이콘 버튼을 누르면 토스 이모지 피커가 뜬다.
 *  아이콘을 고르느라 입력칸 포커스가 빠지므로, blur가 아니라 바깥 클릭으로 취소한다. */
function SpaceEditor({ defaultName = "", defaultIcon = null, saveOnPick = false, onSubmit, onCancel }: {
  defaultName?: string;
  defaultIcon?: string | null;
  /** 수정 모드: 아이콘을 고르면 Enter 없이 바로 저장한다. 추가 모드는 이름이 있어야 만들 수 있어 Enter를 기다린다. */
  saveOnPick?: boolean;
  onSubmit: (name: string, icon: string | null) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [icon, setIcon] = useState<string | null>(defaultIcon);
  const [picking, setPicking] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Element;
      if (rowRef.current?.contains(t) || t.closest?.("[data-emoji-popover]")) return;
      onCancel();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onCancel]);

  function closePicker() {
    setPicking(false);
    inputRef.current?.focus();
  }

  function pick(next: string | null) {
    if (saveOnPick && name.trim()) { onSubmit(name.trim(), next); return; }
    setIcon(next);
    closePicker();
  }

  function submit() {
    const trimmed = name.trim();
    if (trimmed) onSubmit(trimmed, icon);
  }

  return (
    <div ref={rowRef} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 6px" }}>
      <button type="button" title="아이콘 선택" aria-label="아이콘 선택" onClick={() => setPicking((p) => !p)}
        style={{ width: 26, height: 26, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, borderRadius: 7, cursor: "pointer",
          fontFamily: ORG_ICON_FONT, fontSize: 15, boxSizing: "border-box",
          background: picking ? theme.accentWeak : theme.surface2, border: `1px solid ${picking ? theme.accent : "transparent"}` }}>
        <span style={{ opacity: icon ? 1 : 0.45 }}>{icon ?? "📁"}</span>
      </button>
      <input
        ref={inputRef}
        autoFocus
        value={name}
        placeholder="스페이스 이름"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          else if (e.key === "Escape") onCancel();
        }}
        style={{ flex: 1, minWidth: 0, padding: "3px 1px", border: "none", borderBottom: `1.5px solid ${theme.accent}`, borderRadius: 0,
          fontSize: 13, outline: "none", background: "transparent", boxSizing: "border-box" }}
      />
      {picking && rowRef.current && <EmojiPopover anchor={rowRef.current} onPick={pick} onClose={closePicker} />}
    </div>
  );
}

/** 스페이스 행을 드래그로 재정렬할 수 있게 감싸는 sortable 래퍼.
 *  선택 버튼을 드래그 activator로 쓴다. distance:5 제약 덕에 클릭=선택, 5px 이상 이동=재정렬. */
function SortableSpace({ space, active, onSelect, onChangeIcon, onStartEdit, onDelete }: {
  space: Space;
  active: boolean;
  onSelect: () => void;
  onChangeIcon: (icon: string | null) => void;
  onStartEdit: () => void;
  onDelete: () => void;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: `space:${space.id}`,
    data: { kind: "space", space },
  });
  const [hover, setHover] = useState(false);
  const [iconHover, setIconHover] = useState(false);
  const [picking, setPicking] = useState(false);
  const iconRef = useRef<HTMLButtonElement>(null);
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    display: "flex",
    alignItems: "center",
    borderRadius: 8,
    background: active ? theme.accentWeak : "transparent",
  };
  return (
    <div ref={setNodeRef} style={style} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {/* 아이콘은 수정 모드 없이 바로 바꾼다 — 선택(드래그) 버튼과 분리된 별도 버튼. 위치는 예전 아이콘 자리 그대로. */}
      <button type="button" ref={iconRef} title="아이콘 변경" aria-label="아이콘 변경" onClick={() => setPicking((p) => !p)}
        onMouseEnter={() => setIconHover(true)} onMouseLeave={() => setIconHover(false)}
        style={{ marginLeft: 6, width: 26, height: 26, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
          border: "none", borderRadius: 6, cursor: "pointer", background: picking || iconHover ? "rgba(31,36,48,.07)" : "transparent" }}>
        <SpaceIcon icon={space.icon} />
      </button>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} onClick={onSelect}
        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", padding: "7px 10px 7px 4px", border: "none", cursor: "pointer", textAlign: "left",
          background: "transparent", color: active ? theme.accent : "#495057", fontWeight: active ? 600 : 400 }}>
        {space.name}
      </button>
      {picking && iconRef.current && (
        <EmojiPopover anchor={iconRef.current} onPick={(icon) => { setPicking(false); onChangeIcon(icon); }} onClose={() => setPicking(false)} />
      )}
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

export function ExtSidebar({ spaces, sharedSpaces, activeSpaceId, onSelectSpace, onAddSpace, onEditSpace, onDeleteSpace, onLeaveSpace, onCollapse, searchSlot, orgHeaderSlot }: ExtSidebarProps) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Space | null>(null);
  return (
    <>
      <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 2, borderBottom: `1px solid ${theme.border}`, boxSizing: "border-box" }}>
        <div style={{ flex: 1, minWidth: 0 }}>{orgHeaderSlot}</div>
        <button type="button" title="사이드바 접기" aria-label="사이드바 접기" onClick={onCollapse} style={{ flexShrink: 0, border: "none", background: "none", cursor: "pointer", display: "flex", padding: 3 }}>
          <PanelLeftClose size={16} color={theme.textFaint} />
        </button>
      </div>

      <div style={{ padding: "11px 12px" }}>{searchSlot}</div>

      {/* 한글은 자간을 벌리면 읽기 나빠진다 — 영문 대문자용 letterSpacing 1을 0으로 */}
      <div style={{ padding: "4px 14px", fontSize: 10, fontWeight: 700, color: theme.textFaint }}>스페이스</div>
      <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        <SortableContext items={spaces.map((s) => `space:${s.id}`)} strategy={verticalListSortingStrategy}>
          {spaces.map((s) =>
            editingId === s.id ? (
              <SpaceEditor
                key={s.id}
                defaultName={s.name}
                defaultIcon={s.icon}
                saveOnPick
                onSubmit={(name, icon) => { onEditSpace(s.id, name, icon); setEditingId(null); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <SortableSpace
                key={s.id}
                space={s}
                active={s.id === activeSpaceId}
                onSelect={() => onSelectSpace(s.id)}
                onChangeIcon={(icon) => onEditSpace(s.id, s.name, icon)}
                onStartEdit={() => setEditingId(s.id)}
                onDelete={() => setPendingDelete(s)}
              />
            ),
          )}
        </SortableContext>
        {adding ? (
          <SpaceEditor onSubmit={(name, icon) => { onAddSpace(name, icon); setAdding(false); }} onCancel={() => setAdding(false)} />
        ) : (
          <button type="button" onClick={() => setAdding(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", color: theme.textFaint }}>
            <Plus size={15} /> 스페이스 추가
          </button>
        )}
      </div>

      {sharedSpaces.length > 0 && (
        <>
          <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: theme.textFaint }}>공유 스페이스</div>
          {/* 정렬 미구현: 공유됨 섹션은 position 순 표시. DnD는 후속 태스크에서 추가 예정. */}
          <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 2 }}>
            {sharedSpaces.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
                <button type="button" onClick={() => onSelectSpace(s.id)}
                  style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
                    background: s.id === activeSpaceId ? theme.accentWeak : "transparent", color: s.id === activeSpaceId ? theme.accent : "#495057", fontWeight: s.id === activeSpaceId ? 600 : 400 }}>
                  <SpaceIcon icon={s.icon} /> {s.name}
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
