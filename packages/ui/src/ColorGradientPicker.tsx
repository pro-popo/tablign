import { useEffect, useRef, useState, type CSSProperties } from "react";
import { theme } from "./theme";
import { ColorPicker } from "./ColorPicker";
import { parseColorValue, buildColorValue, type ColorValue } from "./colorValue";

export interface ColorGradientPickerProps {
  value: string;
  onChange: (value: string) => void;
  previewIcon?: string;
}

type ActiveStop = "start" | "end" | null;

const MIN_GAP = 10;      // 두 스톱 최소 간격(%)
const DRAG_THRESHOLD = 3; // px — 이보다 크게 움직이면 드래그로 간주(탭 아님)
const HANDLE_INSET = 16;  // px — 핸들 반지름만큼 트랙 안으로

// 시작 색에서 살짝 변형한 기본 끝 색 — 단색→그라데이션 전환 시 사용.
function deriveEndColor(hex: string): string {
  // 마지막 바이트를 회전시켜 시각적으로 구분되는 색을 만든다(단순·결정적).
  const n = parseInt(hex.slice(1), 16);
  const rotated = (n ^ 0x2233aa) & 0xffffff;
  return "#" + rotated.toString(16).padStart(6, "0").toUpperCase();
}

export function ColorGradientPicker({ value, onChange, previewIcon }: ColorGradientPickerProps) {
  // 완전 제어형이면 토글 클릭이 emit만 하고 로컬 재렌더를 유발하지 않아 즉시 반영되지 않는다.
  // ColorPicker와 동일한 self-echo 패턴으로 로컬 값을 두고, 외부 value가 내가 emit한 값과 다를 때만 동기화한다.
  const [localValue, setLocalValue] = useState(value);
  const lastEmit = useRef(value);
  // 직전 렌더에서 본 value prop — "prop 자체가 바뀌었는지"를 useEffect의 deps 배열 없이 렌더 중 판별하기 위함.
  // (emit()이 매 렌더 lastEmit을 최신 로컬값으로 갱신하므로, lastEmit만으로는 self-echo 대기 중인
  // 재렌더와 실제 외부 변경을 구분할 수 없다.)
  const prevValueProp = useRef(value);

  // 외부에서 value가 바뀌면(내가 emit한 self-echo가 아니면) 렌더 중 동기화 — useEffect보다 깜빡임 없음.
  if (value !== prevValueProp.current) {
    prevValueProp.current = value;
    if (value !== lastEmit.current) {
      lastEmit.current = value;
      setLocalValue(value);
    }
  }

  const parsed = parseColorValue(localValue);
  const [active, setActive] = useState<ActiveStop>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ stop: "start" | "end"; moved: boolean } | null>(null);

  useEffect(() => {
    if (!active) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setActive(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setActive(null); }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [active]);

  const isGradient = parsed.kind === "gradient";
  const preview = buildColorValue(parsed);

  function emit(next: ColorValue) {
    const s = buildColorValue(next);
    lastEmit.current = s;
    setLocalValue(s);
    onChange(s);
  }

  function setMode(gradient: boolean) {
    if (gradient && parsed.kind === "solid") {
      emit({ kind: "gradient", start: parsed.hex, end: deriveEndColor(parsed.hex), startPos: 0, endPos: 100 });
    } else if (!gradient && parsed.kind === "gradient") {
      emit({ kind: "solid", hex: parsed.start });
      setActive(null);
    }
  }

  function currentStopHex(): string {
    if (parsed.kind === "solid") return parsed.hex;
    return active === "end" ? parsed.end : parsed.start;
  }

  function setStopHex(hex: string) {
    if (parsed.kind === "solid") { emit({ kind: "solid", hex }); return; }
    if (active === "end") emit({ ...parsed, end: hex });
    else emit({ ...parsed, start: hex });
  }

  function swap() {
    if (parsed.kind !== "gradient") return;
    emit({ ...parsed, start: parsed.end, end: parsed.start });
  }

  function posFromClientX(clientX: number): number {
    const el = barRef.current; if (!el) return 0;
    const r = el.getBoundingClientRect();
    const usable = r.width - HANDLE_INSET * 2;
    const raw = (clientX - r.left - HANDLE_INSET) / (usable || 1);
    return Math.max(0, Math.min(100, Math.round(raw * 100)));
  }

  function onHandlePointerDown(stop: "start" | "end", e: React.PointerEvent) {
    if (parsed.kind !== "gradient") { setActive(active ? null : "start"); return; }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { stop, moved: false };
    const startX = e.clientX;
    function move(ev: PointerEvent) {
      if (!dragRef.current) return;
      if (Math.abs(ev.clientX - startX) > DRAG_THRESHOLD) dragRef.current.moved = true;
      if (!dragRef.current.moved) return;
      if (parsed.kind !== "gradient") return;
      let p = posFromClientX(ev.clientX);
      if (dragRef.current.stop === "start") p = Math.min(p, parsed.endPos - MIN_GAP);
      else p = Math.max(p, parsed.startPos + MIN_GAP);
      p = Math.max(0, Math.min(100, p));
      if (dragRef.current.stop === "start") emit({ ...parsed, startPos: p });
      else emit({ ...parsed, endPos: p });
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const wasDrag = dragRef.current?.moved;
      dragRef.current = null;
      if (!wasDrag) setActive((a) => (a === stop ? null : stop)); // 탭 = 팔레트 토글
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const seg = (on: boolean): CSSProperties => ({
    flex: 1, textAlign: "center", padding: "6px 0", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
    border: "none", background: on ? theme.accent : "transparent", color: on ? "#fff" : theme.textMuted,
  });
  const handleStyle = (bg: string, isActive: boolean, left: string): CSSProperties => ({
    position: "absolute", top: "50%", left, transform: "translate(-50%,-50%)", width: 24, height: 24, borderRadius: "50%",
    border: "3px solid #fff", background: bg, cursor: "pointer", padding: 0, boxSizing: "border-box",
    boxShadow: isActive ? `0 0 0 2px ${theme.accent}, 0 2px 5px rgba(0,0,0,.25)` : "0 0 0 1px rgba(0,0,0,.18), 0 2px 5px rgba(0,0,0,.25)",
  });

  return (
    <div ref={wrapRef} style={{ position: "relative", width: 224, boxSizing: "border-box" }}>
      {/* 토글 */}
      <div style={{ display: "flex", border: `1px solid ${theme.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
        <button type="button" aria-label="단색" aria-pressed={!isGradient} style={seg(!isGradient)} onClick={() => setMode(false)}>단색</button>
        <button type="button" aria-label="그라데이션" aria-pressed={isGradient} style={seg(isGradient)} onClick={() => setMode(true)}>그라데이션</button>
      </div>

      {/* 사각 미리보기 */}
      <div style={{ width: 46, height: 46, borderRadius: 12, margin: "0 auto 12px", background: preview,
        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 26, boxSizing: "border-box" }}>
        {previewIcon ?? ""}
      </div>

      {/* 바 + 인셋 핸들 */}
      <div ref={barRef} data-testid="gradient-bar" style={{ position: "relative", height: 34, borderRadius: 9, background: isGradient
          ? `linear-gradient(90deg, ${parsed.start} ${parsed.startPos}%, ${parsed.end} ${parsed.endPos}%)`
          : (parsed.kind === "solid" ? parsed.hex : ""),
        boxShadow: "0 0 0 1px rgba(0,0,0,.06)" }}>
        {parsed.kind === "solid" ? (
          <button type="button" aria-label="색" style={handleStyle(parsed.hex, active === "start", "50%")}
            onPointerDown={(e) => onHandlePointerDown("start", e)} />
        ) : (
          <>
            <button type="button" aria-label="시작 색" style={handleStyle(parsed.start, active === "start", `${HANDLE_INSET}px`)}
              onPointerDown={(e) => onHandlePointerDown("start", e)} />
            <button type="button" aria-label="끝 색" style={handleStyle(parsed.end, active === "end", `calc(100% - ${HANDLE_INSET}px)`)}
              onPointerDown={(e) => onHandlePointerDown("end", e)} />
          </>
        )}
      </div>

      {/* 스왑(그라데이션만) */}
      {isGradient && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
          <button type="button" aria-label="시작 끝 색 교환" onClick={swap}
            style={{ border: `1px solid ${theme.border}`, background: "#fff", borderRadius: 8, padding: "4px 10px",
              fontSize: 11, color: theme.textMuted, cursor: "pointer" }}>↔ 시작·끝 교환</button>
        </div>
      )}

      {/* 팔레트 팝오버 */}
      {active && (
        <div onClick={(e) => e.stopPropagation()}
          style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8, zIndex: 5,
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12,
            boxShadow: "0 16px 38px rgba(0,0,0,.18)", boxSizing: "border-box" }}>
          <ColorPicker value={currentStopHex()} onChange={setStopHex} />
        </div>
      )}
    </div>
  );
}
