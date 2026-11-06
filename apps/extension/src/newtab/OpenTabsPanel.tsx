import { useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, Download, X, PanelRightClose, PanelRightOpen, Lock, Favicon, theme, useT } from "@tablign/ui";
import { isSaveableTab, saveableTabs, unsaveableReason, type WindowGroup, type WindowTab } from "../lib/tabs";

function TabRow({
  tab, windowId, isSelf, onCloseTab, onActivateTab,
}: {
  tab: WindowTab;
  windowId: number;
  /** tablign 새 탭 자신 — 목록에는 남기되 눌러도 화면이 그대로인 이유를 배지로 알린다 */
  isSelf: boolean;
  onCloseTab: (id: number) => void;
  onActivateTab: (tabId: number, windowId: number) => void;
}) {
  const t = useT();
  const [hover, setHover] = useState(false);
  const saveable = isSaveableTab(tab);
  const reason = unsaveableReason(tab);
  // 담을 수 없는 탭은 드래그 자체를 막는다. 예전에는 드래그가 되고 드롭하면
  // tabDropToLinkInput이 null을 반환해 조용히 무시됐다(원인 표시가 없어 조작이 틀린 줄 알게 된다).
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `tab-${tab.id}`,
    data: { kind: "tab", tab },
    disabled: !saveable,
  });
  const style: React.CSSProperties = {
    boxSizing: "border-box",
    display: "flex", gap: 8, alignItems: "center",
    border: `1px solid ${theme.border}`, borderRadius: 9, padding: "8px 9px",
    // 담을 수 없는 탭: 점선 + 회색 배경으로 "담기지 않는다"만 말한다.
    // 글자 대비는 그대로 둔다 — 흐리게 하면 클릭(=전환)도 안 되는 것처럼 읽힌다.
    background: saveable ? theme.surface : theme.surface2,
    borderStyle: saveable ? "solid" : "dashed",
    transform: isDragging ? undefined : CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    // 끌 수는 없지만 누를 수는 있다 — 커서만으로 그 차이가 전달된다
    cursor: saveable ? "grab" : "pointer",
  };
  return (
    // 클릭(=이동 없는 포인터업)이면 해당 탭으로 전환. 5px 넘게 끌면 PointerSensor가 드래그로 가로채므로 onClick은 안 뜬다.
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      onClick={() => tab.id != null && onActivateTab(tab.id, windowId)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Favicon url={tab.favIconUrl ?? null} />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {tab.title ?? tab.url}
      </span>
      {isSelf ? (
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: theme.textMuted, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 5, padding: "1px 5px", whiteSpace: "nowrap", boxSizing: "border-box" }}>
          {t.openTabsPanel.current}
        </span>
      ) : reason ? (
        <span title={reason} aria-label={reason} style={{ flexShrink: 0, display: "flex" }}>
          <Lock size={13} color={theme.textFaint} />
        </span>
      ) : null}
      <button type="button" title={t.openTabsPanel.closeTab} aria-label={t.openTabsPanel.closeTabLabel(tab.title ?? tab.url ?? "")} onPointerDown={(e) => e.stopPropagation()} onClick={() => tab.id != null && onCloseTab(tab.id)}
        style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 2, opacity: hover ? 1 : 0, pointerEvents: hover ? "auto" : "none", transition: "opacity .12s" }}>
        <X size={14} color={theme.textFaint} />
      </button>
    </div>
  );
}

function WindowGroupView({
  group, index, selfTabId, saving, readOnly, onSaveWindow, onCloseWindow, onCloseTab, onActivateTab,
}: {
  group: WindowGroup;
  index: number;
  selfTabId: number | null;
  /** 이 창을 저장하는 중 — 두 번 눌러 컬렉션이 두 벌 생기는 것을 막는다 */
  saving: boolean;
  readOnly: boolean;
  onSaveWindow: (windowId: number) => void;
  onCloseWindow: (windowId: number) => void;
  onCloseTab: (tabId: number) => void;
  onActivateTab: (tabId: number, windowId: number) => void;
}) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);
  // 빈 창에도 드롭할 수 있도록 탭 목록 컨테이너 자체를 droppable로.
  const { setNodeRef } = useDroppable({ id: `window:${group.windowId}`, data: { kind: "window", windowId: group.windowId } });
  // 담을 수 있는 탭이 0인 창에서 저장을 누르면 링크 0개짜리 컬렉션이 만들어진다 — 버튼을 막는다.
  const saveable = saveableTabs(group.tabs).length;
  // 헤더를 보드로 끌면 놓은 자리에 이 창의 컬렉션을 만든다. 저장 버튼이 막히는 조건이면 끌기도 막는다.
  // 5px 미만 움직임은 클릭이라 접기/펼치기는 그대로 동작한다.
  const draggable = saveable > 0 && !saving && !readOnly;
  const { setNodeRef: setDragRef, listeners } = useDraggable({
    id: `winhead:${group.windowId}`,
    data: { kind: "window", windowId: group.windowId },
    disabled: !draggable,
  });
  return (
    <div style={{ marginBottom: 14 }}>
      {/* 헤더 행 전체 클릭으로 창 접기/펼치기. 저장·닫기 버튼은 stopPropagation으로 토글·끌기 방지. */}
      <div ref={setDragRef} {...listeners} onClick={() => setCollapsed((c) => !c)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: theme.textMuted, marginBottom: 8, cursor: draggable ? "grab" : "pointer", userSelect: "none" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <button type="button" aria-expanded={!collapsed} aria-label={t.openTabsPanel.toggleWindow(index + 1, collapsed)}
            onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c); }}
            style={{ border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, padding: 0, font: "inherit", color: "inherit" }}>
            {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />} {t.openTabsPanel.window(index + 1)}
          </button>
          {collapsed && <span style={{ color: theme.textFaint, fontSize: 12 }}>· {group.tabs.length}</span>}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button type="button" disabled={saveable === 0 || saving}
            aria-busy={saving || undefined}
            title={saving ? t.openTabsPanel.saving : saveable === 0 ? t.openTabsPanel.noneSaveable : t.openTabsPanel.saveCount(saveable)}
            aria-label={saving ? t.openTabsPanel.savingLabel(index + 1) : saveable === 0 ? t.openTabsPanel.noneSaveableLabel(index + 1) : t.openTabsPanel.saveLabel(index + 1, saveable)}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onSaveWindow(group.windowId); }}
            style={{ border: "none", background: "none", cursor: saveable === 0 || saving ? "not-allowed" : "pointer", display: "flex", color: theme.accentInk, opacity: saveable === 0 || saving ? 0.35 : 1 }}>
            <Download size={15} />
          </button>
          <button type="button" title={t.openTabsPanel.closeWindowTitle} aria-label={t.openTabsPanel.closeWindowLabel(index + 1)} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onCloseWindow(group.windowId); }}
            style={{ border: "none", background: "none", cursor: "pointer", display: "flex", color: theme.textFaint }}>
            <X size={15} />
          </button>
        </span>
      </div>
      {!collapsed && (
        <SortableContext items={group.tabs.map((t) => `tab-${t.id}`)} strategy={verticalListSortingStrategy}>
          <div ref={setNodeRef} style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 10 }}>
            {group.tabs.map((t) => (
              <TabRow key={t.id} tab={t} windowId={group.windowId} isSelf={selfTabId != null && t.id === selfTabId}
                onCloseTab={onCloseTab} onActivateTab={onActivateTab} />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

export interface OpenTabsPanelProps {
  groups: WindowGroup[];
  /** tablign 새 탭 자신의 tabId. 목록에서 빼지 않고 '현재 탭' 배지로 표시한다. */
  selfTabId?: number | null;
  /** 지금 저장 중인 창. 그 창의 저장 버튼만 잠근다. */
  savingWindowId?: number | null;
  /** 보드가 읽기 전용(viewer)이면 창을 끌어 컬렉션을 만들 수 없다. */
  readOnly?: boolean;
  onSaveWindow: (windowId: number) => void;
  onCloseWindow: (windowId: number) => void;
  onCloseTab: (tabId: number) => void;
  onActivateTab: (tabId: number, windowId: number) => void;
  onCollapse: () => void;
  /** 덮개로 떠 있을 때 — 머리 버튼이 접기 대신 고정(붙박이로 펼치기)이 된다. 덮개가 레일 자리를 덮으므로 같은 자리에서 누른다. */
  onPin?: () => void;
}

export function OpenTabsPanel({ groups, selfTabId = null, savingWindowId = null, readOnly = false, onSaveWindow, onCloseWindow, onCloseTab, onActivateTab, onCollapse, onPin }: OpenTabsPanelProps) {
  const t = useT();
  return (
    <>
      <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottom: `1px solid ${theme.border}` }}>
        <strong style={{ letterSpacing: ".4px" }}>{t.openTabsPanel.title}</strong>
        <button type="button" title={onPin ? t.openTabsPanel.pin : t.openTabsPanel.collapse} aria-label={onPin ? t.openTabsPanel.pin : t.openTabsPanel.collapse} onClick={onPin ?? onCollapse}
          style={{ border: "none", background: "none", cursor: "pointer", display: "flex", flexShrink: 0 }}>
          {onPin ? <PanelRightOpen size={16} color={theme.textFaint} /> : <PanelRightClose size={16} color={theme.textFaint} />}
        </button>
      </div>
      <div style={{ padding: "11px 13px", overflow: "auto" }}>
        {groups.map((g, i) => (
          <WindowGroupView key={g.windowId} group={g} index={i} selfTabId={selfTabId}
            saving={savingWindowId === g.windowId} readOnly={readOnly}
            onSaveWindow={onSaveWindow} onCloseWindow={onCloseWindow} onCloseTab={onCloseTab} onActivateTab={onActivateTab} />
        ))}
      </div>
    </>
  );
}
