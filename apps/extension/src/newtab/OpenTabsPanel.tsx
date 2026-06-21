import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Download, X, PanelRightClose, Favicon, theme } from "@tablign/ui";
import type { WindowGroup, WindowTab } from "../lib/tabs";

function TabRow({ tab, onCloseTab }: { tab: WindowTab; onCloseTab: (id: number) => void }) {
  const [hover, setHover] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `tab-${tab.id}`,
    data: { kind: "tab", tab },
  });
  const style: React.CSSProperties = {
    display: "flex", gap: 8, alignItems: "center",
    border: `1px solid ${theme.border}`, borderRadius: 9, padding: "8px 9px", background: "#fff",
    // 드래그 중인 행은 슬롯에 고정(transform 억제), 주변 행만 슬라이드. 커서 추적은 DragOverlay 담당.
    transform: isDragging ? undefined : CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: "grab",
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Favicon url={tab.favIconUrl ?? null} />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {tab.title ?? tab.url}
      </span>
      <button type="button" title="탭 닫기" aria-label={`${tab.title ?? tab.url} 닫기`} onPointerDown={(e) => e.stopPropagation()} onClick={() => tab.id != null && onCloseTab(tab.id)}
        style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 2, opacity: hover ? 1 : 0, pointerEvents: hover ? "auto" : "none", transition: "opacity .12s" }}>
        <X size={14} color={theme.textFaint} />
      </button>
    </div>
  );
}

function WindowGroupView({
  group, index, onSaveWindow, onCloseWindow, onCloseTab,
}: {
  group: WindowGroup;
  index: number;
  onSaveWindow: (windowId: number) => void;
  onCloseWindow: (windowId: number) => void;
  onCloseTab: (tabId: number) => void;
}) {
  // 빈 창에도 드롭할 수 있도록 탭 목록 컨테이너 자체를 droppable로.
  const { setNodeRef } = useDroppable({ id: `window:${group.windowId}`, data: { kind: "window", windowId: group.windowId } });
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: theme.textMuted, marginBottom: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><ChevronDown size={15} /> 창 {index + 1}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button type="button" title="이 창의 탭 전체 저장" aria-label={`창 ${index + 1} 전체 저장`} onClick={() => onSaveWindow(group.windowId)}
            style={{ border: "none", background: "none", cursor: "pointer", display: "flex", color: theme.accent }}>
            <Download size={15} />
          </button>
          <button type="button" title="이 창의 탭 전체 닫기" aria-label={`창 ${index + 1} 닫기`} onClick={() => onCloseWindow(group.windowId)}
            style={{ border: "none", background: "none", cursor: "pointer", display: "flex", color: theme.textFaint }}>
            <X size={15} />
          </button>
        </span>
      </div>
      <SortableContext items={group.tabs.map((t) => `tab-${t.id}`)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 10 }}>
          {group.tabs.map((t) => <TabRow key={t.id} tab={t} onCloseTab={onCloseTab} />)}
        </div>
      </SortableContext>
    </div>
  );
}

export interface OpenTabsPanelProps {
  groups: WindowGroup[];
  onSaveWindow: (windowId: number) => void;
  onCloseWindow: (windowId: number) => void;
  onCloseTab: (tabId: number) => void;
  onCollapse: () => void;
}

export function OpenTabsPanel({ groups, onSaveWindow, onCloseWindow, onCloseTab, onCollapse }: OpenTabsPanelProps) {
  return (
    <>
      <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${theme.border}` }}>
        <strong style={{ letterSpacing: ".4px" }}>열린 탭</strong>
        <button type="button" title="패널 접기" aria-label="패널 접기" onClick={onCollapse} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}>
          <PanelRightClose size={16} color={theme.textFaint} />
        </button>
      </div>
      <div style={{ padding: "11px 13px", overflow: "auto" }}>
        {groups.map((g, i) => (
          <WindowGroupView key={g.windowId} group={g} index={i}
            onSaveWindow={onSaveWindow} onCloseWindow={onCloseWindow} onCloseTab={onCloseTab} />
        ))}
      </div>
    </>
  );
}
