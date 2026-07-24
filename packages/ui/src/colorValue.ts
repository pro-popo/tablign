import { normalizeHex } from "./color";

export type ColorValue =
  | { kind: "solid"; hex: string }
  | { kind: "gradient"; start: string; end: string; startPos: number; endPos: number };

export const DEFAULT_COLOR_VALUE: ColorValue = { kind: "solid", hex: "#748FFC" };

// linear-gradient(135deg, #AAA[ p%], #BBB[ q%]) 형태만 인식한다(각도 135° 고정 가정).
const GRAD_RE = /^linear-gradient\(\s*135deg\s*,\s*(#[0-9a-fA-F]{3,6})(?:\s+(\d{1,3})%)?\s*,\s*(#[0-9a-fA-F]{3,6})(?:\s+(\d{1,3})%)?\s*\)$/;

export function parseColorValue(value: string | null | undefined): ColorValue {
  if (!value) return DEFAULT_COLOR_VALUE;
  const trimmed = value.trim();
  const g = trimmed.match(GRAD_RE);
  if (g) {
    const start = normalizeHex(g[1]);
    const end = normalizeHex(g[3]);
    if (start && end) {
      const startPos = g[2] !== undefined ? clampPct(Number(g[2])) : 0;
      const endPos = g[4] !== undefined ? clampPct(Number(g[4])) : 100;
      return { kind: "gradient", start, end, startPos, endPos };
    }
  }
  const hex = normalizeHex(trimmed);
  if (hex) return { kind: "solid", hex };
  return DEFAULT_COLOR_VALUE;
}

export function buildColorValue(v: ColorValue): string {
  if (v.kind === "solid") return v.hex;
  if (v.start === v.end) return v.start; // 시작=끝이면 단색
  if (v.startPos === 0 && v.endPos === 100) {
    return `linear-gradient(135deg, ${v.start}, ${v.end})`;
  }
  return `linear-gradient(135deg, ${v.start} ${v.startPos}%, ${v.end} ${v.endPos}%)`;
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
