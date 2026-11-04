/** 테마 색표 — theme.ts의 색은 여기서 계산한 값을 담은 CSS 변수(--tb-*)를 가리킨다. */
import { gradientCss, type ThemeGradient } from "./gradient";

/** 라이트 값은 테마 도입 전 화면 색 그대로다(바꾸면 기본 화면이 바뀐다). */
export const LIGHT = {
  text: "#1f2430",
  textStrong: "#3b3f46",
  textSub: "#495057",
  textMuted: "#868e96",
  textFaint: "#adb5bd",
  bg: "#fcfcfd",
  surface: "#ffffff",
  surface2: "#f1f3f5",
  surface3: "#e9ecf0",
  border: "#eaecef",
  borderCard: "#e9ebee",
  borderStrong: "#ced4da",
  rail: "#f5f6f8",
  divider: "#e2e5ea",
  danger: "#e03131",
  dangerWeak: "#fff5f5",
  dangerLine: "#f5d0d0",
  warnBg: "#fff8ea",
  warnLine: "#f2e0b8",
  warnInk: "#7a5a15",
  greenDeep: "#2f9e63",
};

export type BaseTokens = typeof LIGHT;

export const DARK: BaseTokens = {
  text: "#e8eaed",
  textStrong: "#d6dade",
  textSub: "#c4c9d0",
  textMuted: "#9aa0a8",
  textFaint: "#6b727b",
  bg: "#141619",
  surface: "#1c1f24",
  surface2: "#262a30",
  surface3: "#30343b",
  border: "#2a2e35",
  borderCard: "#30343b",
  borderStrong: "#3d424a",
  rail: "#17191d",
  divider: "#2a2e35",
  danger: "#ff6b6b",
  dangerWeak: "#3a2023",
  dangerLine: "#5c2d31",
  warnBg: "#2f2715",
  warnLine: "#5a4723",
  warnInk: "#f0cf86",
  greenDeep: "#51cf66",
};

export const DEFAULT_ACCENT = "#3b5bdb";

export type Tokens = BaseTokens & {
  accent: string;
  /** 고른 칸·선택 배경처럼 아주 옅게 */
  accentWeak: string;
  /** 누름·테두리처럼 조금 더 */
  accentSoft: string;
  /** 일러스트·장식처럼 옅은 강조색 */
  accentTint: string;
  /** accentWeak 위에서 읽히는 강조 글자 */
  accentInk: string;
  /** 강조색으로 채운 버튼 위 글자 */
  onAccent: string;
  /** 화면 바닥(배경) — 배경이 없으면 bg */
  page: string;
  /** 배경 위 판(사이드바·오른쪽 패널) 바탕 — 배경이 있으면 투명도만큼 비친다 */
  pane: string;
  /** 배경 위 조직 레일 바탕 */
  paneRail: string;
  /** 배경 위 컬렉션 판 바탕 — 배경이 없으면 투명(판 없음) */
  paneCol: string;
  /** 판 뒤 흐림(backdrop-filter) */
  paneBlur: string;
  /** 배경 위에 바로 놓인 글자(스페이스 제목) — 배경이 진하면 반대 모드 글자색 */
  boardInk: string;
};

export type PageBackground =
  | { kind: "none" }
  | { kind: "solid"; color: string }
  | { kind: "gradient"; gradient: ThemeGradient }
  | { kind: "photo"; url: string | null; veil: number };

// ── 색 계산 ──
const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hexOf = (c: number[]) => "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
const toHex6 = (input: string): string | null => {
  let s = input.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(s)) s = s.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/.test(s) ? "#" + s : null;
};
/** a를 t만큼, b를 1−t만큼 섞는다 */
export const mixHex = (a: string, b: string, t: number) => { const x = rgbOf(a), y = rgbOf(b); return hexOf(x.map((v, i) => v * t + y[i] * (1 - t))); };
const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const luminance = (hex: string) => rgbOf(hex).map(lin).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
export const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
/** on 위에서 4.5:1이 될 때까지 a를 toward 쪽으로 민다 */
function readable(a: string, on: string, toward: string) {
  for (let t = 1; t > 0; t -= 0.05) { const c = mixHex(a, toward, t); if (contrast(c, on) >= 4.5) return c; }
  return toward;
}

/** 기본 강조색은 도입 전 화면의 옅은 강조색을 그대로 쓴다(계산값과 1~2 차이) */
const DEFAULT_LIGHT_TINTS = { accentWeak: "#edf0fe", accentSoft: "#e4e9fd", accentTint: "#c9d4ff" };

export function computeTokens({ dark, accent }: { dark: boolean; accent: string }): Tokens {
  const base = dark ? DARK : LIGHT;
  const a = toHex6(accent) ?? DEFAULT_ACCENT;
  const tints = !dark && a === DEFAULT_ACCENT ? DEFAULT_LIGHT_TINTS
    : dark ? { accentWeak: mixHex(a, base.surface, 0.22), accentSoft: mixHex(a, base.surface, 0.3), accentTint: mixHex(a, base.surface, 0.45) }
    : { accentWeak: mixHex(a, "#ffffff", 0.09), accentSoft: mixHex(a, "#ffffff", 0.14), accentTint: mixHex(a, "#ffffff", 0.3) };
  const white = "#ffffff", w = contrast(white, a);
  return {
    ...base,
    accent: a,
    ...tints,
    accentInk: readable(a, tints.accentWeak, dark ? white : base.text),
    onAccent: w >= 4.5 || w >= contrast(LIGHT.text, a) ? white : LIGHT.text,
    page: base.bg,
    pane: base.surface,
    paneRail: base.rail,
    paneCol: "transparent",
    paneBlur: "none",
    boardInk: base.text,
  };
}

/**
 * 배경을 화면 전체에 깐다. 판(레일·사이드바·패널·컬렉션)은 glass(0~80)만큼 비치고 뒤를 흐린다.
 * viewport: 화면 크기(px) — 그라데이션 점이 화면 %라 방향을 정하려면 필요하다.
 */
export function withBackground(t: Tokens, bg: PageBackground, glass: number, viewport: [number, number], dark: boolean): Tokens {
  if (bg.kind === "none" || (bg.kind === "photo" && !bg.url)) return t;
  const alpha = Math.round((1 - Math.min(80, Math.max(0, glass)) / 100) * 100) / 100;
  const rgba = (hex: string) => `rgba(${rgbOf(hex).join(",")},${alpha})`;
  let page: string, colors: string[] | null = null;
  if (bg.kind === "solid") { page = bg.color; colors = [bg.color]; }
  else if (bg.kind === "gradient") { page = gradientCss(bg.gradient, viewport, viewport); colors = bg.gradient.stops.map((s) => s.color); }
  else {
    const v = Math.min(80, Math.max(0, bg.veil)) / 100, veil = dark ? `rgba(12,14,18,${v})` : `rgba(255,255,255,${v})`;
    page = `linear-gradient(${veil},${veil}), url("${bg.url}") center / cover no-repeat`;
  }
  // 배경 위 글자: 지금 모드 글자색이 배경 색들에 4.5:1이 안 되면 반대 모드 글자색(더 나을 때만)
  let boardInk = t.text;
  if (colors) {
    const hexes = colors.map((c) => toHex6(c)).filter((c): c is string => !!c);
    const worst = (ink: string) => Math.min(...hexes.map((c) => contrast(ink, c)));
    const alt = dark ? LIGHT.text : DARK.text;
    if (hexes.length && worst(t.text) < 4.5 && worst(alt) > worst(t.text)) boardInk = alt;
  }
  return { ...t, page, pane: rgba(t.surface), paneRail: rgba(t.rail), paneCol: rgba(t.surface), paneBlur: "blur(16px)", boardInk };
}

const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
export const tokenVar = (k: keyof Tokens) => `--tb-${kebab(k)}`;

export function tokenVars(t: Tokens): Record<string, string> {
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [tokenVar(k as keyof Tokens), v]));
}

export function applyTokens(el: HTMLElement, t: Tokens) {
  for (const [k, v] of Object.entries(tokenVars(t))) el.style.setProperty(k, v);
  el.style.colorScheme = t.bg === DARK.bg ? "dark" : "light";
}
