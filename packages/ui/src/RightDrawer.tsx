import { useEffect, useRef, useState, type ReactNode } from "react";
import { theme } from "./theme";
import { useT } from "./i18n";

// 덮개와 같은 움직임 — 들어올 땐 감속, 나갈 땐 가속. 움직임 줄이기면 바로 바뀐다.
const OUT_MS = 180;
const css = `
.tb-drawer { animation: tb-drawer-in .26s cubic-bezier(.32,.72,0,1) }
.tb-drawer[data-closing] { animation: tb-drawer-out ${OUT_MS}ms cubic-bezier(.4,0,1,1) forwards }
@keyframes tb-drawer-in { from { transform: translateX(100%) } }
@keyframes tb-drawer-out { to { transform: translateX(100%); visibility: hidden } }
@media (prefers-reduced-motion: reduce) {
  .tb-drawer, .tb-drawer[data-closing] { animation: none }
  .tb-drawer[data-closing] { visibility: hidden }
}
`;
// 가장자리에 붙는 짧은 그림자 + 퍼지는 그림자(왼쪽으로 2px·8px). 그림자는 서랍 크기라 화면 위아래 끝에서 흐려진다
// (맨 위는 머리 옆) — 번짐만큼 퍼뜨려 위아래 밖까지 늘리고, 그만큼 오른쪽으로 옮겨 왼쪽 끝은 그대로 둔다.
const SHADOW = "3px 0 5px 5px rgba(20,30,60,.06), 16px 0 24px 24px rgba(20,30,60,.14)";

export interface RightDrawerProps {
  open: boolean;
  width: number;
  /** 왼쪽 끝을 끌 때 — 새 너비(px). 범위는 부르는 쪽이 맞춘다 */
  onResize: (width: number) => void;
  /** 서랍 이름(크기 조절 손잡이 이름에도 쓴다) */
  label: string;
  children: ReactNode;
}

/**
 * 셸 오른쪽 끝에 따로 덮어 띄우는 서랍(설정). 열린 탭 패널과 따로 열리고 너비도 따로다.
 * 경계선 없이 왼쪽 그림자로 보드 위에 떠 보인다. 닫으면 빠져나간 뒤에 내린다 — 숨은 채 남아 키 입력을 받지 않게.
 */
export function RightDrawer({ open, width, onResize, label, children }: RightDrawerProps) {
  const t = useT();
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setMounted(false), OUT_MS);
    return () => clearTimeout(t);
  }, [open]);
  if (!mounted) return null;

  return (
    <section aria-label={label} className="tb-drawer" data-closing={!open || undefined}
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, width, zIndex: 55, display: "flex", flexDirection: "column",
        background: theme.pane, backdropFilter: theme.paneBlur, boxShadow: SHADOW }}>
      <style>{css}</style>
      <Grip label={t.rightDrawer.resize(label)} width={width} onResize={onResize} />
      {children}
    </section>
  );
}

/** 왼쪽 끝 크기 조절 손잡이. 평소 투명, 올리면 강조색 줄. */
function Grip({ label, width, onResize }: { label: string; width: number; onResize: (w: number) => void }) {
  const [hover, setHover] = useState(false);
  const drag = useRef<{ x: number; w: number } | null>(null);
  const end = () => { drag.current = null; };
  return (
    <div role="separator" aria-orientation="vertical" aria-label={label}
      onPointerDown={(e) => {
        // jsdom 등에서 setPointerCapture가 없을 수 있어 막는다
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
        drag.current = { x: e.clientX, w: width };
      }}
      onPointerMove={(e) => { if (drag.current) onResize(drag.current.w + drag.current.x - e.clientX); }}
      onPointerUp={end} onLostPointerCapture={end}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 6, cursor: "col-resize", zIndex: 5, boxSizing: "border-box",
        borderLeft: `2px solid ${hover ? theme.accent : "transparent"}` }} />
  );
}
