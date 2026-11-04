import { useEffect, useRef, useState, type ReactNode } from "react";
import { PanelLeftOpen, PanelRightOpen } from "./icons";
import { theme } from "./theme";
import type { HoverPeek } from "./useHoverPeek";

export interface AppShellProps {
  left: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  leftWidth?: number;
  rightWidth?: number;
  onResizeLeft?: (w: number) => void;
  onResizeRight?: (w: number) => void;
  /** 좁은 화면: 사이드바는 붙박이로 두지 않는다(왼쪽엔 조직 레일만 남는다). */
  narrow?: boolean;
  /** 접어 둔 패널(좁은 화면의 사이드바 포함)을 올려 볼 때의 덮개 상태. 열리면 보드를 밀지 않고 위에 덮는다. */
  leftPeek?: HoverPeek;
  rightPeek?: HoverPeek;
  /** 패널들 위에 따로 덮어 띄우는 것(테마 서랍) — 셸 안에 그려 셸 밖으로 삐져나가지 않는다 */
  overlay?: ReactNode;
}

const RAIL = 44;
const DEFAULT_LEFT_WIDTH = 212;
const DEFAULT_RIGHT_WIDTH = 272;
// 폭 전환 시간(ms). CSS transition과 Rail 교체 지연을 같은 값으로 묶는다.
const PANEL_ANIM_MS = 200;

// 좁은 화면 덮개: 왼쪽은 조직 레일 뒤에서, 오른쪽은 화면 끝에서 서랍처럼 미끄러져 나온다.
// 다 나온 뒤엔 transform을 none으로 둬, 안의 확인 창(position: fixed)이 화면 기준으로 뜨게 한다.
const peekCss = `
.tbl-peek { box-shadow: none; transition: transform .18s cubic-bezier(.4,0,1,1), box-shadow .18s, visibility .18s }
.tbl-peek.l { transform: translateX(-100%) }
.tbl-peek.r { transform: translateX(100%) }
.tbl-peek[data-open] { transform: none; transition: transform .26s cubic-bezier(.32,.72,0,1), box-shadow .26s, visibility 0s }
.tbl-peek.l[data-open] { box-shadow: 10px 0 32px rgba(20,30,60,.18) }
.tbl-peek.r[data-open] { box-shadow: -10px 0 32px rgba(20,30,60,.18) }
@media (prefers-reduced-motion: reduce) {
  .tbl-peek, .tbl-peek[data-open] { transform: none; opacity: 0; transition: opacity .12s, visibility .12s }
  .tbl-peek[data-open] { opacity: 1 }
}
`;

function Rail({ onClick, label, icon }: { onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 10 }}>
      <button type="button" title={label} aria-label={label} onClick={onClick}
        style={{ border: "none", background: "none", cursor: "pointer", display: "flex", padding: 4, height: "fit-content" }}>
        {icon}
      </button>
    </div>
  );
}

/**
 * 패널 내용을 열림 폭으로 고정하는 래퍼. aside가 접히며 좁아질 때 내용이 찌그러지지 않고
 * overflow로 잘려 나간다. 동시에 폭 축소와 같은 시간으로 페이드아웃해, 내용이 끝에 한 번에
 * 사라지지 않고 닫히는 내내 함께 사라진다("너무 늦게 사라지는" 느낌 제거).
 */
function PanelBody({ width, visible, children }: { width: number; visible: boolean; children: ReactNode }) {
  return (
    <div style={{
      width, height: "100%", flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden",
      opacity: visible ? 1 : 0,
      transition: `opacity ${PANEL_ANIM_MS}ms ease`,
    }}>
      {children}
    </div>
  );
}

/**
 * 접힘/펼침 상태를 애니메이션과 맞춰 지연시킨다. 펼칠 땐 즉시 내용을 보이고,
 * 접을 땐 폭 축소 애니메이션(PANEL_ANIM_MS)이 끝난 뒤에야 Rail로 교체한다.
 * → 접히는 동안 실제 내용이 남아 함께 밀려 사라진다.
 */
function useDeferredCollapse(open: boolean): boolean {
  const [collapsed, setCollapsed] = useState(!open);
  useEffect(() => {
    if (open) { setCollapsed(false); return; }
    const t = setTimeout(() => setCollapsed(true), PANEL_ANIM_MS);
    return () => clearTimeout(t);
  }, [open]);
  return collapsed;
}

/** 패널 안쪽 경계의 리사이즈 핸들. 평소 투명, 호버 시 accent 라인. */
function ResizeHandle({
  side, width, onStart, onMove, onEnd,
}: {
  side: "left" | "right";
  width: number;
  onStart: (e: React.PointerEvent, width: number, side: "left" | "right") => void;
  onMove: (e: React.PointerEvent) => void;
  onEnd: (e: React.PointerEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === "left" ? "왼쪽 패널 크기 조절" : "오른쪽 패널 크기 조절"}
      onPointerDown={(e) => onStart(e, width, side)}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onLostPointerCapture={onEnd}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        boxSizing: "border-box",
        position: "absolute", top: 0, bottom: 0,
        [side === "left" ? "right" : "left"]: 0,
        width: 6, cursor: "col-resize", zIndex: 5,
        [side === "left" ? "borderRight" : "borderLeft"]: `2px solid ${hover ? theme.accent : "transparent"}`,
      }}
    />
  );
}

export function AppShell({
  left, right, children, leftOpen, rightOpen, onToggleLeft, onToggleRight,
  leftWidth = DEFAULT_LEFT_WIDTH, rightWidth = DEFAULT_RIGHT_WIDTH, onResizeLeft, onResizeRight,
  narrow = false, leftPeek, rightPeek, overlay: drawer,
}: AppShellProps) {
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number; side: "left" | "right" } | null>(null);
  const leftCollapsed = useDeferredCollapse(leftOpen);
  const rightCollapsed = useDeferredCollapse(rightOpen);

  function startDrag(e: React.PointerEvent, width: number, side: "left" | "right") {
    // jsdom 등 환경에서 setPointerCapture 미구현할 수 있어 방어.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    dragRef.current = { startX: e.clientX, startWidth: width, side };
    setDragging(true);
  }
  function moveDrag(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const delta = e.clientX - dragRef.current.startX;
    const next = dragRef.current.side === "left" ? dragRef.current.startWidth + delta : dragRef.current.startWidth - delta;
    (dragRef.current.side === "left" ? onResizeLeft : onResizeRight)?.(next);
  }
  function endDrag(e: React.PointerEvent) {
    dragRef.current = null;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }

  const panel = (side: "left" | "right", open: boolean, openWidth: number): React.CSSProperties => ({
    width: open ? openWidth : RAIL,
    flexShrink: 0,
    // 드래그 중에는 폭 애니메이션을 꺼 랙을 없앤다(열기/닫기 때만 부드럽게).
    transition: dragging ? "none" : `width ${PANEL_ANIM_MS}ms ease`,
    overflow: "hidden",
    // 배경이 있으면 판이 투명도만큼 비치고 뒤를 흐린다(없으면 surface 그대로)
    background: theme.pane,
    backdropFilter: theme.paneBlur,
    [side === "left" ? "borderRight" : "borderLeft"]: `1px solid ${theme.border}`,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  });

  // 덮개 — 좁은 화면, 그리고 넓은 화면에서 접어 둔 패널을 올려 볼 때. 끌기 도중 끌던 탭이 사라지지 않게
  // 접혀 있는 동안은 늘 붙여 두고 보이기만 켜고 끈다(펼쳐 두면 붙박이 쪽만 그려 같은 내용이 둘이 되지 않게 한다).
  const overlay = (side: "left" | "right", peek: HoverPeek, width: number, content: ReactNode) => (
    <div ref={peek.ref} onMouseEnter={peek.enter} onMouseLeave={peek.leave} onBlur={peek.blur} aria-hidden={!peek.open}
      className={`tbl-peek ${side === "left" ? "l" : "r"}`} data-open={peek.open || undefined}
      style={{
        position: "absolute", top: 0, bottom: 0, [side]: 0, width, zIndex: 50, display: "flex", flexDirection: "column", overflow: "hidden",
        background: theme.pane, backdropFilter: theme.paneBlur, [side === "left" ? "borderRight" : "borderLeft"]: `1px solid ${theme.border}`,
        visibility: peek.open ? "visible" : "hidden",
      }}>
      <PanelBody width={width} visible>{content}</PanelBody>
    </div>
  );
  // 접힌 레일에 올리면 덮개를 연다. 레일 아이콘을 누르면 지금처럼 붙박이로 고정(onToggle)한다.
  const railHover = (peek: HoverPeek | undefined, collapsed: boolean) =>
    peek && collapsed ? { onMouseEnter: peek.enter, onMouseLeave: peek.leave } : {};

  return (
    // overflow: hidden — 덮개가 바깥에서 미끄러져 들어오는 동안 레일 뒤·화면 밖으로 삐져나가지 않게
    <div style={{ position: "relative", display: "flex", height: "100vh", overflow: "hidden", background: "transparent", color: theme.text, fontFamily: "-apple-system, system-ui, sans-serif", fontSize: 13 }}>
      {(leftPeek || rightPeek) && <style>{peekCss}</style>}
      {/* 좁은 화면의 사이드바는 레일 없이 덮개만 — 왼쪽엔 조직 레일만 남는다 */}
      {narrow ? (leftPeek && overlay("left", leftPeek, leftWidth, left)) : (
        <aside style={panel("left", leftOpen, leftWidth)} {...railHover(leftPeek, leftCollapsed)}>
          {leftCollapsed
            ? <Rail onClick={onToggleLeft} label="사이드바 열기" icon={<PanelLeftOpen size={18} color={theme.textFaint} />} />
            : <PanelBody width={leftWidth} visible={leftOpen}>{left}</PanelBody>}
          {leftOpen && <ResizeHandle side="left" width={leftWidth} onStart={startDrag} onMove={moveDrag} onEnd={endDrag} />}
        </aside>
      )}
      {!narrow && leftCollapsed && leftPeek && overlay("left", leftPeek, leftWidth, left)}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }} onPointerMove={moveDrag} onPointerUp={endDrag} onLostPointerCapture={endDrag}>
        {children}
      </main>
      {right && (
        <aside style={panel("right", rightOpen, rightWidth)} {...railHover(rightPeek, rightCollapsed)}>
          {rightCollapsed
            ? <Rail onClick={onToggleRight} label="열린 탭 열기" icon={<PanelRightOpen size={18} color={theme.textFaint} />} />
            : <PanelBody width={rightWidth} visible={rightOpen}>{right}</PanelBody>}
          {rightOpen && <ResizeHandle side="right" width={rightWidth} onStart={startDrag} onMove={moveDrag} onEnd={endDrag} />}
        </aside>
      )}
      {right && rightCollapsed && rightPeek && overlay("right", rightPeek, rightWidth, right)}
      {drawer}
    </div>
  );
}
