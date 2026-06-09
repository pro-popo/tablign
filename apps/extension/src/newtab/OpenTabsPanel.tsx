import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { ChevronDown, Download, X, PanelRightClose, Favicon, theme } from "@tablign/ui";
import type { WindowGroup, WindowTab } from "../lib/tabs";

function TabRow({ tab, onCloseTab }: { tab: WindowTab; onCloseTab: (id: number) => void }) {
  const [hover, setHover] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tab-${tab.id}`,
    data: { kind: "tab", tab },
  });
  const style: React.CSSProperties = {
    display: "flex", gap: 8, alignItems: "center",
    border: `1px solid ${theme.border}`, borderRadius: 9, padding: "8px 9px", background: "#fff",
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
          <div key={g.windowId} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: theme.textMuted, marginBottom: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><ChevronDown size={15} /> 창 {i + 1}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <button type="button" title="이 창의 탭 전체 저장" aria-label={`창 ${i + 1} 전체 저장`} onClick={() => onSaveWindow(g.windowId)}
                  style={{ border: "none", background: "none", cursor: "pointer", display: "flex", color: theme.accent }}>
                  <Download size={15} />
                </button>
                <button type="button" title="이 창의 탭 전체 닫기" aria-label={`창 ${i + 1} 닫기`} onClick={() => onCloseWindow(g.windowId)}
                  style={{ border: "none", background: "none", cursor: "pointer", display: "flex", color: theme.textFaint }}>
                  <X size={15} />
                </button>
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {g.tabs.map((t) => <TabRow key={t.id} tab={t} onCloseTab={onCloseTab} />)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
