import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { theme } from "./theme";
import { useT } from "./i18n";
import { normalizeHex } from "./color";
import { ColorPicker } from "./ColorPicker";
import { Pipette } from "./icons";

/** 고른 칸 표시 — 무난한 하늘색 링을 칸에 바짝(틈 1.5px). 다른 테두리를 겹쳐 그리지 않는다. */
export const SELECT_RING_COLOR = "#4DABF7";
export const selectRing = `0 0 0 1.5px ${theme.surface}, 0 0 0 3.5px ${SELECT_RING_COLOR}`;

const RAINBOW = "conic-gradient(#ff6b6b,#fcc419,#51cf66,#22b8cf,#5c7cfa,#cc5de8,#ff6b6b)";
const RAINBOW_SOFT = "conic-gradient(#ffc9c9,#ffec99,#b2f2bb,#99e9f2,#bac8ff,#eebefa,#ffc9c9)";

const popCss = `@keyframes tbl-pop-in { from { opacity: 0; transform: translateY(-4px) } }`;

export interface SwatchRowProps {
  colors: readonly string[];
  /** 지금 색 — 목록에 있으면 그 칸, 없으면 무지개 칸이 그 색으로 채워진다 */
  value: string;
  onChange: (hex: string) => void;
  columns: number;
  /** circle: 강조색처럼 동그란 칸 / tile: 빠른 색처럼 납작한 칸 */
  shape?: "circle" | "tile";
  /** 칸마다 이름(마우스를 올리면·읽기 프로그램). 없으면 색 코드 */
  labels?: readonly string[];
  /** 직접 고른 색으로 칠하는 중인지(목록에 같은 색이 있어도 무지개 칸을 고른 것으로) */
  customSelected?: boolean;
  /** 팝오버를 연 채로 둘 곳 — 여기를 눌러도 닫지 않는다(그라데이션 미리보기 등) */
  keepOpenSelector?: string;
}

/** 색 칸 줄 + 끝의 무지개 칸. 무지개 칸을 누르면 칸 줄 바로 밑에 '직접 고르기' 팝오버가 뜬다(아래 내용을 밀지 않고 겹친다). */
export function SwatchRow({ colors, value, onChange, columns, shape = "tile", labels, customSelected, keepOpenSelector }: SwatchRowProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const customRef = useRef<HTMLButtonElement>(null);
  const v = normalizeHex(value) ?? value;
  const inList = colors.some((c) => normalizeHex(c) === v);
  const isCustom = customSelected ?? !inList;
  const circle = shape === "circle";
  const cell = (bg: string, on: boolean) => ({
    border: "none", padding: 0, cursor: "pointer", background: bg, boxSizing: "border-box" as const, position: "relative" as const,
    ...(circle ? { width: 26, height: 26, borderRadius: "50%" } : { height: 22, width: "100%", borderRadius: 6, boxShadow: `inset 0 0 0 1px ${theme.border}` }),
    ...(on ? { boxShadow: selectRing } : {}),
  });
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: circle ? "10px 0" : 6, justifyItems: circle ? "center" : "stretch" }}>
        {colors.map((c, i) => {
          const on = !isCustom && normalizeHex(c) === v;
          return <button key={c} type="button" title={labels?.[i] ?? c} aria-label={labels?.[i] ?? c} aria-pressed={on}
            onClick={() => onChange(normalizeHex(c) ?? c)} style={cell(c, on)} />;
        })}
        <button ref={customRef} type="button" title={t.swatchRow.custom} aria-label={t.swatchRow.custom} aria-expanded={open} aria-pressed={isCustom}
          onClick={() => setOpen((o) => !o)}
          style={cell(isCustom ? v : circle ? RAINBOW : RAINBOW_SOFT, isCustom && !open)} />
      </div>
      {open && <ColorPopover value={v} onChange={onChange} onClose={() => setOpen(false)} triggerRef={customRef} keepOpenSelector={keepOpenSelector} />}
    </div>
  );
}

interface EyeDropperCtor { new (): { open(): Promise<{ sRGBHex: string }> } }

function ColorPopover({ value, onChange, onClose, triggerRef, keepOpenSelector }: {
  value: string; onChange: (hex: string) => void; onClose: () => void;
  triggerRef: RefObject<HTMLElement>; keepOpenSelector?: string;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [tailX, setTailX] = useState(0);
  const close = useRef(onClose);
  close.current = onClose;

  // 꼬리는 누른 칸 가운데를 가리키고, 열 때 패널 아래로 넘치면 보이게 스크롤한다(열 때 한 번만)
  useLayoutEffect(() => {
    const t = triggerRef.current;
    if (t) setTailX(t.offsetLeft + t.offsetWidth / 2);
    ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [triggerRef]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (!el || ref.current?.contains(el) || triggerRef.current?.contains(el) || (keepOpenSelector && el.closest?.(keepOpenSelector))) return;
      close.current();
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down, true); document.removeEventListener("keydown", key); };
  }, [triggerRef, keepOpenSelector]);

  const Eye = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
  const pick = () => {
    if (!Eye) return;
    new Eye().open().then(({ sRGBHex }) => { const n = normalizeHex(sRGBHex); if (n) onChange(n); }).catch(() => { /* 사용자가 취소 */ });
  };

  return (
    <div ref={ref} role="dialog" aria-label={t.swatchRow.custom}
      style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 10px)", zIndex: 40, padding: 12, borderRadius: 14, boxSizing: "border-box",
        background: theme.surface, boxShadow: `0 0 0 1px ${theme.border}, 0 14px 32px rgba(20,30,60,.18)`, animation: "tbl-pop-in .14s ease-out" }}>
      <style>{popCss}</style>
      <span aria-hidden="true" style={{ position: "absolute", top: -6, left: tailX - 6, width: 12, height: 12, borderRadius: 2, transform: "rotate(45deg)",
        background: theme.surface, boxShadow: `-1px -1px 0 0 ${theme.border}` }} />
      <ColorPicker value={value} onChange={onChange}
        extra={Eye ? (
          <button type="button" title={t.swatchRow.eyedropper} aria-label={t.swatchRow.eyedropper} onClick={pick}
            style={{ width: 30, height: 30, flex: "none", border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.surface, color: theme.textSub,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
            <Pipette size={14} />
          </button>
        ) : null} />
    </div>
  );
}
