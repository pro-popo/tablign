import { useRef, useState, type CSSProperties } from "react";
import { theme } from "./theme";
import { ColorPicker } from "./ColorPicker";
import { parseColorValue, buildColorValue, type ColorValue } from "./colorValue";

export interface ColorGradientPickerProps {
  value: string;
  onChange: (value: string) => void;
  previewIcon?: string;
}

type ActiveStop = "start" | "end";

const MIN_GAP = 10;      // 두 스톱 최소 간격(%)
const DRAG_THRESHOLD = 3; // px — 이보다 크게 움직이면 드래그로 간주(탭 아님)
const HANDLE_INSET = 16;  // px — 핸들 반지름만큼 트랙 안으로

// 단색 값이 넘어오면 표시용 끝 색을 만들 때 쓴다 — 시작 색을 살짝 변형(항상 시작≠끝).
function deriveEndColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const rotated = (n ^ 0x2233aa) & 0xffffff;
  return "#" + rotated.toString(16).padStart(6, "0").toUpperCase();
}

type GradientValue = Extract<ColorValue, { kind: "gradient" }>;

// 항상 그라데이션 편집기 — 단색 값이 오면 표시용 그라데이션으로 승격한다(사용자가 손대기 전엔 emit하지 않음).
function asGradient(v: ColorValue): GradientValue {
  if (v.kind === "gradient") return v;
  return { kind: "gradient", start: v.hex, end: deriveEndColor(v.hex), startPos: 0, endPos: 100 };
}

export function ColorGradientPicker({ value, onChange, previewIcon }: ColorGradientPickerProps) {
  // 완전 제어형이면 클릭이 emit만 하고 로컬 재렌더를 유발하지 않아 즉시 반영되지 않는다.
  // ColorPicker와 동일한 self-echo 패턴으로 로컬 값을 두고, 외부 value가 내가 emit한 값과 다를 때만 동기화한다.
  const [localValue, setLocalValue] = useState(value);
  const lastEmit = useRef(value);
  // 직전 렌더에서 본 value prop — "prop 자체가 바뀌었는지"를 렌더 중 판별하기 위함.
  const prevValueProp = useRef(value);

  // 외부에서 value가 바뀌면(내가 emit한 self-echo가 아니면) 렌더 중 동기화 — useEffect보다 깜빡임 없음.
  if (value !== prevValueProp.current) {
    prevValueProp.current = value;
    if (value !== lastEmit.current) {
      lastEmit.current = value;
      setLocalValue(value);
    }
  }

  const parsed = asGradient(parseColorValue(localValue));
  const [active, setActive] = useState<ActiveStop>("end");
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ stop: ActiveStop; moved: boolean } | null>(null);

  const preview = buildColorValue(parsed);

  function emit(next: GradientValue) {
    const s = buildColorValue(next);
    lastEmit.current = s;
    setLocalValue(s);
    onChange(s);
  }

  const activeStopHex = active === "end" ? parsed.end : parsed.start;

  function setStopHex(hex: string) {
    if (active === "end") emit({ ...parsed, end: hex });
    else emit({ ...parsed, start: hex });
  }

  function posFromClientX(clientX: number): number {
    const el = barRef.current; if (!el) return 0;
    const r = el.getBoundingClientRect();
    const usable = r.width - HANDLE_INSET * 2;
    const raw = (clientX - r.left - HANDLE_INSET) / (usable || 1);
    return Math.max(0, Math.min(100, Math.round(raw * 100)));
  }

  function onHandlePointerDown(stop: ActiveStop, e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { stop, moved: false };
    const startX = e.clientX;
    function move(ev: PointerEvent) {
      if (!dragRef.current) return;
      if (Math.abs(ev.clientX - startX) > DRAG_THRESHOLD) dragRef.current.moved = true;
      if (!dragRef.current.moved) return;
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
      if (!wasDrag) setActive(stop); // 탭 = 그 스톱 선택
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const handleStyle = (bg: string, isActive: boolean, left: string): CSSProperties => ({
    position: "absolute", top: "50%", left, transform: "translate(-50%,-50%)", width: 24, height: 24, borderRadius: "50%",
    border: "3px solid #fff", background: bg, cursor: "pointer", padding: 0, boxSizing: "border-box",
    boxShadow: isActive ? `0 0 0 2px ${theme.accent}, 0 2px 5px rgba(0,0,0,.25)` : "0 0 0 1px rgba(0,0,0,.18), 0 2px 5px rgba(0,0,0,.25)",
  });
  // 핸들의 가로 위치 — 스톱 %를 인셋 트랙 안(HANDLE_INSET ~ 폭-HANDLE_INSET)으로 매핑.
  // posFromClientX의 역함수라 드래그하는 만큼 원이 따라 움직인다.
  const stopLeft = (pos: number) => `calc(${HANDLE_INSET}px + (100% - ${HANDLE_INSET * 2}px) * ${pos / 100})`;
  const chipStyle = (isActive: boolean): CSSProperties => ({
    flex: 1, display: "flex", alignItems: "center", gap: 7, padding: "6px 9px", borderRadius: 8, cursor: "pointer",
    border: `1px solid ${isActive ? theme.accent : theme.border}`, background: isActive ? "#f5f7ff" : "#fff", boxSizing: "border-box",
  });

  const chip = (stop: ActiveStop, label: string, hex: string) => (
    <button type="button" aria-label={`${label} 색 선택`} style={chipStyle(active === stop)} onClick={() => setActive(stop)}>
      <span style={{ width: 16, height: 16, borderRadius: 5, flex: "none", background: hex, boxShadow: "0 0 0 1px rgba(0,0,0,.08)" }} />
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
        <span style={{ fontSize: 8.5, color: theme.textFaint, fontWeight: 700, letterSpacing: ".3px" }}>{label}</span>
        <span style={{ fontSize: 10.5, color: theme.textMuted, fontFamily: "monospace" }}>{hex}</span>
      </span>
    </button>
  );

  return (
    <div style={{ position: "relative", width: 224, boxSizing: "border-box" }}>
      {/* 사각 미리보기 */}
      <div style={{ width: 46, height: 46, borderRadius: 12, margin: "0 auto 12px", background: preview,
        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 26, boxSizing: "border-box" }}>
        {previewIcon ?? ""}
      </div>

      {/* 바 + 인셋 핸들 (드래그=비율, 탭=선택) */}
      <div ref={barRef} data-testid="gradient-bar" style={{ position: "relative", height: 34, borderRadius: 9,
        background: `linear-gradient(90deg, ${parsed.start} ${parsed.startPos}%, ${parsed.end} ${parsed.endPos}%)`,
        boxShadow: "0 0 0 1px rgba(0,0,0,.06)" }}>
        <button type="button" aria-label="시작 색" style={handleStyle(parsed.start, active === "start", stopLeft(parsed.startPos))}
          onPointerDown={(e) => onHandlePointerDown("start", e)} />
        <button type="button" aria-label="끝 색" style={handleStyle(parsed.end, active === "end", stopLeft(parsed.endPos))}
          onPointerDown={(e) => onHandlePointerDown("end", e)} />
      </div>

      {/* 중간 색 정보(시작·끝 hex) — 클릭 시 그 스톱 선택 */}
      <div style={{ display: "flex", gap: 8, margin: "13px 0" }}>
        {chip("start", "시작", parsed.start)}
        {chip("end", "끝", parsed.end)}
      </div>

      {/* 선택 스톱 편집 팔레트(항상 표시, hex 행 없음) */}
      <ColorPicker hideHex value={activeStopHex} onChange={setStopHex} />
    </div>
  );
}
