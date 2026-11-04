/** 배경 그라데이션 — 화면 % 좌표의 두 점 + 그 사이 색들(2~4개). 함수는 모두 새 값을 돌려준다(원본을 바꾸지 않음). */
export type Point = [number, number];
export interface GradientStop { color: string; pos: number }
export interface ThemeGradient {
  type: "linear" | "radial";
  /** 직선: 시작·끝 점 / 원형: 중심·크기 점 */
  points: [Point, Point];
  /** pos 0~100 — 첫 점(0)에서 둘째 점(100)까지의 비율 */
  stops: GradientStop[];
}

export const MAX_STOPS = 4;
/** 이웃한 색끼리 최소 간격(%) */
export const MIN_GAP = 5;
export const GRADIENT_POINTS: Record<ThemeGradient["type"], [Point, Point]> = {
  linear: [[10, 12], [90, 88]],
  radial: [[50, 50], [88, 88]],
};

export function defaultGradient(type: ThemeGradient["type"] = "linear"): ThemeGradient {
  const [a, b] = GRADIENT_POINTS[type];
  return { type, points: [[...a], [...b]], stops: [{ color: "#BAC8FF", pos: 0 }, { color: "#FFD8C2", pos: 100 }] };
}

const stopList = (g: ThemeGradient) => g.stops.map((s) => `${s.color} ${s.pos}%`).join(", ");

/**
 * CSS background 문자열. 점은 기준 화면(ref, px) 위의 %이고, [W,H] 상자에 그린다.
 * 상자 비율이 기준 화면과 달라도 같은 모양이 되게 기준 화면에서 그린 그라데이션을 늘려 옮긴다(미리보기용).
 */
export function gradientCss(g: ThemeGradient, [W, H]: [number, number], [Wr, Hr]: [number, number]): string {
  const [[ax, ay], [bx, by]] = g.points;
  if (g.type === "radial") {
    const r = Math.max(1, Math.hypot((bx - ax) / 100 * Wr, (by - ay) / 100 * Hr));
    return `radial-gradient(ellipse ${(r / Wr * W).toFixed(1)}px ${(r / Hr * H).toFixed(1)}px at ${ax}% ${ay}%, ${stopList(g)})`;
  }
  // 기준 화면에서 A→B에 수직인 선들이 같은 색 — 늘린 상자에선 그 법선이 (Wr/W, Hr/H)만큼 기운다
  let nx = (bx - ax) / 100 * Wr * Wr / W, ny = (by - ay) / 100 * Hr * Hr / H;
  const m = Math.hypot(nx, ny) || 1; nx /= m; ny /= m;
  const L = Math.abs(W * nx) + Math.abs(H * ny) || 1;
  const t = (x: number, y: number) => ((x / 100 * W - W / 2) * nx + (y / 100 * H - H / 2) * ny) / L + 0.5;
  const t0 = t(ax, ay), t1 = t(bx, by);
  const deg = (Math.atan2(nx, -ny) * 180 / Math.PI).toFixed(1);
  return `linear-gradient(${deg}deg, ${g.stops.map((s) => `${s.color} ${((t0 + (t1 - t0) * s.pos / 100) * 100).toFixed(1)}%`).join(", ")})`;
}

/** 상자 위 점(x,y %)을 첫 점→둘째 점 선에 내렸을 때의 비율 t와 선까지 거리(px) */
export function onLine(g: ThemeGradient, x: number, y: number, W: number, H: number): [number, number] {
  const [[ax, ay], [bx, by]] = g.points;
  const dx = (bx - ax) * W / 100, dy = (by - ay) * H / 100, px = (x - ax) * W / 100, py = (y - ay) * H / 100;
  const t = (px * dx + py * dy) / (dx * dx + dy * dy || 1);
  return [t, Math.hypot(px - t * dx, py - t * dy)];
}

/** 빠른 색 중 아직 안 쓴 첫 색(다 쓰면 첫 색) */
export const nextColor = (g: ThemeGradient, quick: readonly string[]) =>
  quick.find((q) => !g.stops.some((s) => s.color.toUpperCase() === q.toUpperCase())) ?? quick[0];

/** 선 위 p(0~100) 자리에 색을 넣는다. 꽉 찼거나 들어갈 틈이 없으면 null */
export function addStop(g: ThemeGradient, p: number, color: string): { gradient: ThemeGradient; index: number } | null {
  const st = g.stops, i = st.findIndex((s) => s.pos > p);
  if (st.length >= MAX_STOPS || i <= 0 || st[i].pos - st[i - 1].pos < MIN_GAP * 2) return null;
  const pos = Math.round(Math.max(st[i - 1].pos + MIN_GAP, Math.min(st[i].pos - MIN_GAP, p)));
  return { gradient: { ...g, stops: [...st.slice(0, i), { color, pos }, ...st.slice(i)] }, index: i };
}

/** 가장 넓은 틈 가운데에 넣는다 */
export function addInGap(g: ThemeGradient, color: string) {
  const st = g.stops;
  let k = 1;
  for (let i = 2; i < st.length; i++) if (st[i].pos - st[i - 1].pos > st[k].pos - st[k - 1].pos) k = i;
  return addStop(g, (st[k].pos + st[k - 1].pos) / 2, color);
}

/**
 * i번째 색을 뺀다(두 색이면 그대로). 끝점을 빼면 옆 색 자리까지 선을 줄여 모양을 그대로 둔다.
 * 원형 중심은 옮기지 않고 옆 색이 새 중심 색이 된다. sel: 빼고 난 뒤 고를 칸.
 */
export function removeStop(g: ThemeGradient, i: number): { gradient: ThemeGradient; sel: number } {
  const st = g.stops, n = st.length;
  if (n <= 2) return { gradient: g, sel: Math.min(i, n - 1) };
  const [[ax, ay], [bx, by]] = g.points;
  const at = (q: number): Point => [Math.round(ax + (bx - ax) * q / 100), Math.round(ay + (by - ay) * q / 100)];
  let points = g.points;
  let stops = st.map((s) => ({ ...s }));
  if (i === n - 1) {
    const k = st[n - 2].pos;
    points = [g.points[0], at(k)];
    stops = stops.map((s) => ({ ...s, pos: Math.round(s.pos / (k || 1) * 100) }));
  } else if (i === 0 && g.type === "linear") {
    const k = st[1].pos;
    points = [at(k), g.points[1]];
    stops = stops.map((s) => ({ ...s, pos: Math.round((s.pos - k) / (100 - k || 1) * 100) }));
  }
  stops.splice(i, 1);
  if (i === 0) stops[0].pos = 0;
  return { gradient: { ...g, points, stops }, sel: Math.min(i, stops.length - 1) };
}

/** 색 순서를 거꾸로(자리도 거꾸로) */
export const flipStops = (g: ThemeGradient): ThemeGradient =>
  ({ ...g, stops: [...g.stops].reverse().map((s) => ({ color: s.color, pos: 100 - s.pos })) });
