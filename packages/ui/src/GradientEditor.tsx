import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { theme } from "./theme";
import { useT } from "./i18n";
import { Segmented } from "./Segmented";
import { SwatchRow, selectRing } from "./SwatchRow";
import { ArrowLeftRight, Plus, Trash2, RotateCcw } from "./icons";
import {
  gradientCss, onLine, addStop, addInGap, removeStop, flipStops, nextColor, defaultGradient,
  GRADIENT_POINTS, MAX_STOPS, MIN_GAP, type ThemeGradient, type Point,
} from "./gradient";

export interface GradientEditorProps {
  value: ThemeGradient;
  /** 다 바꿨을 때(놓았을 때·도구·빠른 색) */
  onChange: (g: ThemeGradient) => void;
  /** 점을 끄는 동안 — 저장하지 않고 화면에만 미리 보여 준다 */
  onPreview?: (g: ThemeGradient) => void;
  quickColors: readonly string[];
  /** 화면 크기(px) — 점이 화면 %라, 미리보기를 같은 모양으로 그리려면 필요하다 */
  viewport: [number, number];
}

const PREVIEW_H = 170;
/** 선에서 이만큼(px) 안쪽을 누르면 색을 더한다 */
const HIT = 14;
const clamp100 = (n: number) => Math.round(Math.min(100, Math.max(0, n)));
const PREVIEW = "[data-gradient-preview]";

/** 그라데이션 편집 — 위 한 줄(직선·원형 + 도구), 미리보기에서 점 끌기, 아래 빠른 색 줄(고른 점의 색). */
export function GradientEditor({ value, onChange, onPreview, quickColors, viewport }: GradientEditorProps) {
  const t = useT();
  const [draft, setDraft] = useState<ThemeGradient | null>(null);
  const g = draft ?? value;
  const n = g.stops.length;
  const [selRaw, setSel] = useState(n - 1);
  const sel = Math.min(selRaw, n - 1);
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(244);
  const latest = useRef({ value, onChange, sel });
  latest.current = { value, onChange, sel };

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => { if (el.clientWidth) setW(el.clientWidth); };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 지우기 키로 고른 색 빼기 — 입력 칸에 있을 땐 그 칸 글자를 지운다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select") || t.isContentEditable)) return;
      const { value: v, onChange: change, sel: s } = latest.current;
      if (v.stops.length <= 2) return;
      const r = removeStop(v, s);
      setSel(r.sel);
      change(r.gradient);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const pct = (e: { clientX: number; clientY: number }) => {
    const r = boxRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / (r.width || 1) * 100, (e.clientY - r.top) / (r.height || 1) * 100, r.width || W, r.height || PREVIEW_H] as const;
  };

  function onPointerDown(e: React.PointerEvent) {
    const handle = (e.target as Element).closest<HTMLElement>("[data-stop]");
    let work = value, i: number, kind: "a" | "b" | "m", added = false;
    if (handle) {
      i = +handle.dataset.stop!;
      kind = i === 0 ? "a" : i === n - 1 ? "b" : "m";
    } else {
      // 선(원형이면 중심→크기 선) 가까이 빈 곳을 누르면 그 자리에 색을 더하고 바로 끈다
      const [x, y, bw, bh] = pct(e);
      const [t, dist] = onLine(value, x, y, bw, bh);
      const r = t > 0.03 && t < 0.97 && dist <= HIT ? addStop(value, t * 100, nextColor(value, quickColors)) : null;
      if (!r) return;
      work = r.gradient; i = r.index; kind = "m"; added = true;
      setDraft(work);
    }
    e.preventDefault();
    setSel(i);
    const x0 = e.clientX, y0 = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 3) return;
      moved = true;
      const [x, y, bw, bh] = pct(ev);
      if (kind === "m") {
        const st = work.stops, p = Math.round(onLine(work, x, y, bw, bh)[0] * 100);
        const pos = Math.max(st[i - 1].pos + MIN_GAP, Math.min(st[i + 1].pos - MIN_GAP, p));
        work = { ...work, stops: st.map((s, k) => (k === i ? { ...s, pos } : s)) };
      } else {
        const pt: Point = [clamp100(x), clamp100(y)];
        work = { ...work, points: kind === "a" ? [pt, work.points[1]] : [work.points[0], pt] };
      }
      setDraft(work);
      onPreview?.(work);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDraft(null);
      if (moved || added) onChange(work);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const setColor = (hex: string) => onChange({ ...g, stops: g.stops.map((s, k) => (k === sel ? { ...s, color: hex } : s)) });
  const add = () => { const r = addInGap(g, nextColor(g, quickColors)); if (r) { setSel(r.index); onChange(r.gradient); } };
  const del = () => { const r = removeStop(g, sel); setSel(r.sel); onChange(r.gradient); };

  // ── 미리보기 그리기 ──
  const [[ax, ay], [bx, by]] = g.points;
  const X = (x: number) => x / 100 * W, Y = (y: number) => y / 100 * PREVIEW_H;
  const along = (q: number): Point => [ax + (bx - ax) * q / 100, ay + (by - ay) * q / 100];
  const pos = (k: number): Point => (k === 0 ? g.points[0] : k === n - 1 ? g.points[1] : along(g.stops[k].pos));
  const rRef = Math.hypot((bx - ax) / 100 * viewport[0], (by - ay) / 100 * viewport[1]);
  const seg = { x1: X(ax), y1: Y(ay), x2: X(bx), y2: Y(by) };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: "none", width: 112 }}>
          <Segmented small items={[{ value: "linear", label: t.gradientEditor.linear }, { value: "radial", label: t.gradientEditor.radial }]} value={g.type}
            onChange={(type) => { const [a, b] = GRADIENT_POINTS[type]; onChange({ ...g, type, points: [[...a], [...b]] }); }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 1, padding: 2, borderRadius: 8, background: theme.surface2 }}>
          <Tool label={t.gradientEditor.flip} onClick={() => { setSel(n - 1 - sel); onChange(flipStops(g)); }}><ArrowLeftRight size={15} /></Tool>
          <Tool label={t.gradientEditor.addStop} onClick={add} disabled={n >= MAX_STOPS}><Plus size={15} /></Tool>
          <Tool label={t.gradientEditor.removeStop} onClick={del} disabled={n <= 2}><Trash2 size={15} /></Tool>
          <i aria-hidden="true" style={{ width: 1, alignSelf: "stretch", margin: "4px 3px", background: theme.border }} />
          <Tool label={t.gradientEditor.reset} onClick={() => { setSel(1); onChange(defaultGradient(g.type)); }}><RotateCcw size={15} /></Tool>
        </div>
      </div>
      <div ref={boxRef} data-gradient-preview onPointerDown={onPointerDown}
        style={{ position: "relative", height: PREVIEW_H, borderRadius: 10, touchAction: "none", cursor: "crosshair",
          background: gradientCss(g, [W, PREVIEW_H], viewport), boxShadow: `0 0 0 1px ${theme.border}` }}>
        <svg viewBox={`0 0 ${W} ${PREVIEW_H}`} preserveAspectRatio="none" aria-hidden="true"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
          {g.type === "radial" && (
            <ellipse cx={X(ax)} cy={Y(ay)} rx={rRef / viewport[0] * W} ry={rRef / viewport[1] * PREVIEW_H}
              fill="none" stroke="#fff" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.9} />
          )}
          {/* 색과 색을 잇는 선 — 흰 점선(어두운 바탕선 위) */}
          <line {...seg} stroke="rgba(0,0,0,.2)" strokeWidth={3} strokeDasharray="5 4" />
          <line {...seg} stroke="#fff" strokeWidth={1.5} strokeDasharray="5 4" />
        </svg>
        {g.stops.map((s, k) => {
          const [px, py] = pos(k), mid = k > 0 && k < n - 1;
          return <button key={k} type="button" data-stop={k} aria-label={t.gradientEditor.stops[k === 0 ? "start" : k === n - 1 ? "end" : "middle"]} aria-pressed={sel === k}
            style={handle(s.color, mid, sel === k, px, py)} />;
        })}
      </div>
      <div style={{ marginTop: 12 }}>
        <SwatchRow colors={quickColors} value={g.stops[sel].color} onChange={setColor} columns={quickColors.length + 1} keepOpenSelector={PREVIEW} />
      </div>
    </div>
  );
}

function Tool({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled}
      style={{ width: 28, height: 26, border: "none", borderRadius: 6, padding: 0, display: "flex", alignItems: "center", justifyContent: "center",
        background: "none", color: theme.textSub, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.3 : 1 }}>
      {children}
    </button>
  );
}

const handle = (color: string, mid: boolean, on: boolean, x: number, y: number): CSSProperties => ({
  position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", zIndex: on ? 2 : 1,
  width: mid ? 15 : 18, height: mid ? 15 : 18, borderRadius: "50%", padding: 0, cursor: "grab", boxSizing: "border-box",
  border: `${mid ? 2 : 3}px solid #fff`, background: color,
  boxShadow: on ? `${selectRing}, 0 2px 6px rgba(0,0,0,.28)` : "0 0 0 1px rgba(0,0,0,.2), 0 2px 6px rgba(0,0,0,.28)",
});
