import { useRef, useState, useEffect } from "react";
import { theme } from "./theme";
import { hexToHsv, hsvToHex, normalizeHex } from "./color";

export interface ColorPickerProps { value: string; onChange: (hex: string) => void; hideHex?: boolean }

export function ColorPicker({ value, onChange, hideHex = false }: ColorPickerProps) {
  const init = hexToHsv(value) ?? { h: 222, s: 0.8, v: 0.9 };
  const [h, setH] = useState(init.h);
  const [s, setS] = useState(init.s);
  const [v, setV] = useState(init.v);
  const [hexText, setHexText] = useState(value);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  // 방금 내가 emit한 hex. controlled 부모가 이 값을 그대로 되돌려줄 때(self-echo) hue 재계산을 건너뛴다.
  // (검정/흰색 등 achromatic에서 hexToHsv가 h=0을 주므로, self-echo까지 반영하면 hue가 빨강으로 초기화됨)
  const lastEmit = useRef(value);

  // 외부 value 변경만 반영(대표 스와치 클릭 등). 내가 emit한 값(self-echo)은 무시해 내부 hue를 보존.
  useEffect(() => {
    if (value === lastEmit.current) return;
    const c = hexToHsv(value);
    if (c) { setH(c.h); setS(c.s); setV(c.v); setHexText(value); lastEmit.current = value; }
  }, [value]);

  function emit(nh: number, ns: number, nv: number) {
    const hex = hsvToHex(nh, ns, nv);
    lastEmit.current = hex;
    setHexText(hex);
    onChange(hex);
  }
  function onSvPointer(e: React.PointerEvent) {
    const el = svRef.current; if (!el) return;
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const ns = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const nv = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
    setS(ns); setV(nv); emit(h, ns, nv);
  }
  function onHuePointer(e: React.PointerEvent) {
    const el = hueRef.current; if (!el) return;
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const nh = Math.min(360, Math.max(0, ((e.clientX - r.left) / r.width) * 360));
    setH(nh); emit(nh, s, v);
  }
  const hueHex = hsvToHex(h, 1, 1);
  const current = hsvToHex(h, s, v);

  return (
    <div>
      <div ref={svRef}
        onPointerDown={onSvPointer}
        onPointerMove={(e) => { if (e.buttons === 1) onSvPointer(e); }}
        style={{ width: "100%", height: 130, borderRadius: 10, position: "relative", cursor: "crosshair", boxSizing: "border-box",
          background: `linear-gradient(to top,#000,rgba(0,0,0,0)), linear-gradient(to right,#fff,${hueHex})` }}>
        <span style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", border: "3px solid #fff", boxShadow: "0 0 0 1px #0004",
          left: `calc(${s * 100}% - 7px)`, top: `calc(${(1 - v) * 100}% - 7px)`, boxSizing: "border-box" }} />
      </div>
      <div ref={hueRef}
        onPointerDown={onHuePointer}
        onPointerMove={(e) => { if (e.buttons === 1) onHuePointer(e); }}
        style={{ height: 14, borderRadius: 7, marginTop: 10, position: "relative", cursor: "pointer",
          background: "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}>
        <span style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 0 0 1px #0004",
          left: `calc(${(h / 360) * 100}% - 8px)`, top: -1, background: hueHex, boxSizing: "border-box" }} />
      </div>
      {!hideHex && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: current, boxSizing: "border-box" }} />
          <input value={hexText} onChange={(e) => {
              setHexText(e.target.value);
              const n = normalizeHex(e.target.value);
              if (n) { const c = hexToHsv(n)!; setH(c.h); setS(c.s); setV(c.v); onChange(n); }
            }}
            style={{ flex: 1, border: `1px solid ${theme.border}`, borderRadius: 8, padding: "6px 9px", fontSize: 12, fontFamily: "monospace", boxSizing: "border-box" }} />
        </div>
      )}
    </div>
  );
}
