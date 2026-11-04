import { describe, it, expect } from "vitest";
import { gradientCss, addStop, addInGap, removeStop, flipStops, onLine, nextColor, defaultGradient, type ThemeGradient } from "../gradient";

const REF: [number, number] = [562, 640];
const lin = (points: ThemeGradient["points"], stops = defaultGradient().stops): ThemeGradient => ({ type: "linear", points, stops });
const angle = (css: string) => +css.match(/^linear-gradient\((-?[\d.]+)deg/)![1];
const positions = (css: string) => [...css.matchAll(/#[0-9A-F]{6} (-?[\d.]+)%/gi)].map((m) => +m[1]);

describe("gradientCss", () => {
  it("직선 처음 값은 왼위→오아래(약 138°), 점이 그라데이션 선 위 비율로 간다", () => {
    const css = gradientCss(defaultGradient(), REF, REF);
    expect(angle(css)).toBeGreaterThan(130);
    expect(angle(css)).toBeLessThan(145);
    const [p0, p1] = positions(css);
    expect(p0).toBeGreaterThan(0);
    expect(p1).toBeLessThan(100);
  });

  it("가로로 놓으면 90°, 상자 비율이 달라도 같은 방향", () => {
    const g = lin([[10, 50], [90, 50]]);
    expect(angle(gradientCss(g, REF, REF))).toBeCloseTo(90, 0);
    expect(angle(gradientCss(g, [244, 170], REF))).toBeCloseTo(90, 0);
  });

  it("미리보기 상자에서도 끝점이 같은 비율에 온다(늘려 그리기)", () => {
    const g = lin([[0, 0], [100, 100]]);
    expect(positions(gradientCss(g, REF, REF))).toEqual([0, 100]);
    expect(positions(gradientCss(g, [244, 170], REF))).toEqual([0, 100]);
  });

  it("원형은 기준 화면 반지름을 상자 비율로 늘린 타원", () => {
    const g: ThemeGradient = { type: "radial", points: [[50, 50], [80, 50]], stops: defaultGradient().stops };
    expect(gradientCss(g, [200, 100], [100, 100])).toBe("radial-gradient(ellipse 60.0px 30.0px at 50% 50%, #BAC8FF 0%, #FFD8C2 100%)");
  });
});

describe("색 더하기·빼기·뒤집기", () => {
  const g4 = (): ThemeGradient => lin([[10, 12], [90, 88]], [
    { color: "#111111", pos: 0 }, { color: "#222222", pos: 30 }, { color: "#333333", pos: 60 }, { color: "#444444", pos: 100 },
  ]);

  it("선 위 비율 자리에 넣고 이웃과 5%는 띄운다", () => {
    const r = addStop(defaultGradient(), 2, "#C3F0DC")!;
    expect(r.index).toBe(1);
    expect(r.gradient.stops.map((s) => s.pos)).toEqual([0, 5, 100]);
    expect(addStop(g4(), 50, "#C3F0DC")).toBeNull();
  });

  it("추가는 가장 넓은 틈 가운데", () => {
    const g = lin([[0, 0], [100, 100]], [{ color: "#111111", pos: 0 }, { color: "#222222", pos: 20 }, { color: "#333333", pos: 100 }]);
    expect(addInGap(g, "#C3F0DC")!.gradient.stops.map((s) => s.pos)).toEqual([0, 20, 60, 100]);
  });

  it("두 색이면 빼지 않는다", () => {
    const g = defaultGradient();
    expect(removeStop(g, 0).gradient).toBe(g);
  });

  it("끝점을 빼면 옆 색 자리까지 선을 줄여 모양을 그대로 둔다", () => {
    const before = gradientCss(g4(), REF, REF);
    const after = removeStop(g4(), 3);
    expect(after.gradient.stops).toHaveLength(3);
    expect(after.gradient.stops.at(-1)!.pos).toBe(100);
    const b = positions(before).slice(0, 3), a = positions(gradientCss(after.gradient, REF, REF));
    a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(1.5));
    const first = removeStop(g4(), 0);
    expect(first.gradient.stops[0]).toEqual({ color: "#222222", pos: 0 });
    positions(gradientCss(first.gradient, REF, REF)).forEach((v, i) => expect(Math.abs(v - positions(before)[i + 1])).toBeLessThan(1.5));
  });

  it("원형 중심을 빼면 중심은 두고 옆 색이 새 중심 색", () => {
    const g: ThemeGradient = { ...g4(), type: "radial", points: [[50, 50], [90, 90]] };
    const r = removeStop(g, 0);
    expect(r.gradient.points[0]).toEqual([50, 50]);
    expect(r.gradient.stops[0]).toEqual({ color: "#222222", pos: 0 });
  });

  it("뒤집기는 순서와 자리를 거꾸로", () => {
    expect(flipStops(g4()).stops).toEqual([
      { color: "#444444", pos: 0 }, { color: "#333333", pos: 40 }, { color: "#222222", pos: 70 }, { color: "#111111", pos: 100 },
    ]);
  });

  it("빠른 색 중 아직 안 쓴 색", () => {
    expect(nextColor(defaultGradient(), ["#BAC8FF", "#FFD8C2", "#C3F0DC"])).toBe("#C3F0DC");
  });
});

describe("onLine", () => {
  it("선 위로 내린 비율과 선까지 거리(px)", () => {
    const g = lin([[0, 50], [100, 50]]);
    const [t, d] = onLine(g, 25, 60, 200, 100);
    expect(t).toBeCloseTo(0.25);
    expect(d).toBeCloseTo(10);
  });
});
