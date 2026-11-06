import { normalizeHex, computeTokens, withBackground, defaultGradient, MAX_STOPS, type ThemeGradient, type Point, type Tokens, type PageBackground } from "@tablign/ui";

export type ThemeMode = "light" | "dark" | "system";
export type BackgroundKind = "none" | "solid" | "gradient" | "photo";
/** 확장에 넣어 둔 예시 사진(public/backgrounds) — 이 순서(봄 → 여름 → 가을 → 겨울)로 보인다. 이름은 사전 themeSettings.photos */
export const SAMPLE_PHOTOS = {
  blossom: { url: "backgrounds/blossom.svg" },
  sea: { url: "backgrounds/sea.svg" },
  mountain: { url: "backgrounds/mountain.svg" },
  sunset: { url: "backgrounds/sunset.svg" },
  cloudsea: { url: "backgrounds/cloudsea.svg" },
  snow: { url: "backgrounds/snow.svg" },
  aurora: { url: "backgrounds/aurora.svg" },
  night: { url: "backgrounds/night.svg" },
};
export type PhotoSource = keyof typeof SAMPLE_PHOTOS | "upload";
const PHOTO_SOURCES = [...Object.keys(SAMPLE_PHOTOS), "upload"] as PhotoSource[];

export interface ThemeSettings {
  v: 1;
  mode: ThemeMode;
  accent: { preset: number } | { custom: string };
  /** 배경 종류를 바꿔도 다른 종류의 값은 남는다(돌아오면 그대로). */
  background: {
    kind: BackgroundKind;
    solid: string;
    gradient: ThemeGradient;
    photo: { source: PhotoSource; path: string | null; veil: number };
  };
  /** 배경 위 판(레일·사이드바·패널·컬렉션)이 비치는 정도 0~80 */
  glass: number;
}

/** 익숙한 앱 색 — 첫 칸은 브랜드 인디고, 빨강은 위험 표시와 헷갈려서 뺐다. 이름은 사전 themeSettings.accents(같은 순서) */
export const ACCENT_PRESETS = [
  { hex: "#3B5BDB" },
  { hex: "#2563EB" },
  { hex: "#0369A1" },
  { hex: "#0F766E" },
  { hex: "#15803D" },
  { hex: "#C2410C" },
  { hex: "#DB2777" },
  { hex: "#7C3AED" },
  { hex: "#475569" },
] as const;

export const SOLID_QUICK = ["#E9E4FE", "#FEDFE2", "#FFE1CF", "#CCF2E6", "#D0EDFE", "#F4E7CC"];
/** 그라데이션 점 색 — 번지는 게 보이게 단색보다 한 톤 진하다 */
export const GRADIENT_QUICK = ["#BAC8FF", "#FFD8C2", "#C3F0DC", "#FFC9DE", "#FFF0B3", "#D0BCFF"];

export const DEFAULT_THEME: ThemeSettings = {
  v: 1,
  mode: "light",
  accent: { preset: 0 },
  background: { kind: "none", solid: SOLID_QUICK[0], gradient: defaultGradient("linear"), photo: { source: "mountain", path: null, veil: 35 } },
  glass: 30,
};

// ── 검증 ──
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const num = (x: unknown, lo: number, hi: number, d: number) =>
  typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : d;
const hex = (x: unknown, d: string) => (typeof x === "string" && normalizeHex(x)) || d;
const oneOf = <T extends string>(x: unknown, list: readonly T[], d: T): T => (list.includes(x as T) ? (x as T) : d);

function normalizeGradient(x: unknown): ThemeGradient {
  if (!isObj(x)) return defaultGradient("linear");
  const type = oneOf(x.type, ["linear", "radial"] as const, "linear");
  const d = defaultGradient(type);
  const pts = Array.isArray(x.points) && x.points.length === 2 && x.points.every((p) => Array.isArray(p) && p.length === 2)
    ? (x.points as unknown[][]).map((p) => [num(p[0], 0, 100, 50), num(p[1], 0, 100, 50)] as Point) as [Point, Point]
    : d.points;
  const raw = Array.isArray(x.stops) ? x.stops.filter(isObj) : [];
  const stops = raw.length >= 2 && raw.length <= MAX_STOPS
    ? raw.map((s) => ({ color: hex(s.color, "#FFFFFF"), pos: num(s.pos, 0, 100, 0) })).sort((a, b) => a.pos - b.pos)
    : d.stops;
  return { type, points: pts, stops };
}

/** 서버·캐시에서 읽은 값은 늘 여기를 거친다 — 빠지거나 이상한 값은 처음 값으로 채운다 */
export function normalizeTheme(raw: unknown): ThemeSettings {
  const r = isObj(raw) ? raw : {};
  const d = DEFAULT_THEME;
  const a = isObj(r.accent) ? r.accent : {};
  const accent: ThemeSettings["accent"] = typeof a.custom === "string" && normalizeHex(a.custom)
    ? { custom: normalizeHex(a.custom)! }
    : { preset: Number.isInteger(a.preset) && (a.preset as number) >= 0 && (a.preset as number) < ACCENT_PRESETS.length ? (a.preset as number) : 0 };
  const bg = isObj(r.background) ? r.background : {};
  const ph = isObj(bg.photo) ? bg.photo : {};
  return {
    v: 1,
    mode: oneOf(r.mode, ["light", "dark", "system"] as const, d.mode),
    accent,
    background: {
      kind: oneOf(bg.kind, ["none", "solid", "gradient", "photo"] as const, d.background.kind),
      solid: hex(bg.solid, d.background.solid),
      gradient: normalizeGradient(bg.gradient),
      photo: {
        source: oneOf(ph.source, PHOTO_SOURCES, d.background.photo.source),
        path: typeof ph.path === "string" && ph.path ? ph.path : null,
        veil: num(ph.veil, 0, 80, d.background.photo.veil),
      },
    },
    glass: num(r.glass, 0, 80, d.glass),
  };
}

export const accentHex = (s: ThemeSettings) => ("custom" in s.accent ? s.accent.custom : ACCENT_PRESETS[s.accent.preset].hex);
export const isDarkTheme = (s: ThemeSettings, systemDark: boolean) => s.mode === "dark" || (s.mode === "system" && systemDark);

/** 설정 → 화면 바닥. 올린 사진은 내려받아 둔 주소(uploadUrl)가 있어야 그린다 */
export function pageBackground(s: ThemeSettings, uploadUrl: string | null): PageBackground {
  const b = s.background;
  if (b.kind === "solid") return { kind: "solid", color: b.solid };
  if (b.kind === "gradient") return { kind: "gradient", gradient: b.gradient };
  if (b.kind === "photo") return { kind: "photo", url: b.photo.source === "upload" ? uploadUrl : SAMPLE_PHOTOS[b.photo.source].url, veil: b.photo.veil };
  return { kind: "none" };
}

export const viewportSize = (): [number, number] =>
  typeof window === "undefined" ? [1440, 900] : [window.innerWidth || 1440, window.innerHeight || 900];

export function themeTokens(s: ThemeSettings, systemDark: boolean, viewport: [number, number] = viewportSize(), uploadUrl: string | null = null): Tokens {
  const dark = isDarkTheme(s, systemDark);
  return withBackground(computeTokens({ dark, accent: accentHex(s) }), pageBackground(s, uploadUrl), s.glass, viewport, dark);
}

// ── 기기 캐시: 새 탭 첫 화면을 동기로 그리려고 localStorage에 둔다 ──
export const THEME_CACHE_KEY = "tablign.theme";
/** 서버에 아직 못 보낸 변경이 있다는 표시 — 다음 새 탭에서 서버로 다시 보낸다 */
export const THEME_PENDING_KEY = "tablign.theme.pending";

export function readThemeCache(): ThemeSettings {
  try {
    const raw = localStorage.getItem(THEME_CACHE_KEY);
    return raw ? normalizeTheme(JSON.parse(raw)) : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeThemeCache(s: ThemeSettings) {
  try { localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(s)); } catch { /* 저장소가 막혀도 화면은 그대로 */ }
}

export const systemPrefersDark = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
