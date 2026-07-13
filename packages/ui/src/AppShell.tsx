import { useRef, useState, type ReactNode } from "react";
import { PanelLeftOpen, PanelRightOpen } from "./icons";
import { theme } from "./theme";

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
}

const RAIL = 44;
const DEFAULT_LEFT_WIDTH = 212;
const DEFAULT_RIGHT_WIDTH = 272;

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
}: AppShellProps) {
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number; side: "left" | "right" } | null>(null);

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
    transition: dragging ? "none" : "width 0.2s ease",
    overflow: "hidden",
    background: theme.surface,
    [side === "left" ? "borderRight" : "borderLeft"]: `1px solid ${theme.border}`,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  });

  return (
    <div style={{ display: "flex", height: "100vh", background: theme.bg, color: theme.text, fontFamily: "-apple-system, system-ui, sans-serif", fontSize: 13 }}>
      <aside style={panel("left", leftOpen, leftWidth)}>
        {leftOpen ? left : <Rail onClick={onToggleLeft} label="사이드바 열기" icon={<PanelLeftOpen size={18} color={theme.textFaint} />} />}
        {leftOpen && <ResizeHandle side="left" width={leftWidth} onStart={startDrag} onMove={moveDrag} onEnd={endDrag} />}
      </aside>
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }} onPointerMove={moveDrag} onPointerUp={endDrag} onLostPointerCapture={endDrag}>
        {children}
      </main>
      {right && (
        <aside style={panel("right", rightOpen, rightWidth)}>
          {rightOpen ? right : <Rail onClick={onToggleRight} label="열린 탭 열기" icon={<PanelRightOpen size={18} color={theme.textFaint} />} />}
          {rightOpen && <ResizeHandle side="right" width={rightWidth} onStart={startDrag} onMove={moveDrag} onEnd={endDrag} />}
        </aside>
      )}
    </div>
  );
}
