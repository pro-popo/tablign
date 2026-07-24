import { describe, it, expect } from "vitest";
import { orgIconStyle, ORG_ICON_FONT } from "./orgIcon";

const transformY = (t: unknown) => Number(/translate\(0px, ([\d.]+)px\)/.exec(String(t))![1]);

describe("orgIconStyle", () => {
  it("이모지 폰트 스택을 Tossface 1순위로 적용한다", () => {
    const s = orgIconStyle({ icon_scale: 100, icon_x: 0, icon_y: 0 }, 32);
    expect(s.fontFamily).toBe(ORG_ICON_FONT);
    expect(ORG_ICON_FONT).toMatch(/^"Tossface"/);
  });
  it("박스 비례 폰트 크기(0.68)를 유지한다", () => {
    const s = orgIconStyle({}, 100);
    expect(s.fontSize).toBeCloseTo(68, 5);
  });

  it("폰트 크기를 반올림하지 않는다(렌더 지점 간 baseline 정확 일치)", () => {
    // 헤더 박스 28 → 19.04. 반올림하면 렌더 지점 정렬이 어긋난다(커밋 f11cfc4 참고).
    const s = orgIconStyle({}, 28);
    expect(s.fontSize).toBeCloseTo(19.04, 5);
  });

  it("scale 1(100%)에서는 세로 보정이 0이다(소형 정중앙을 건드리지 않음)", () => {
    const s = orgIconStyle({ icon_scale: 100, icon_x: 0, icon_y: 0 }, 44);
    expect(s.transform).toBe("translate(0px, 0px) scale(1)");
  });

  it("확대 시 드리프트를 box·0.048·(scale-1)만큼 아래로 상쇄한다", () => {
    // 200%, box 32 → y = 0 + 32*0.048*(2-1) = 1.536px.
    const s = orgIconStyle({ icon_scale: 200, icon_x: 0, icon_y: 0 }, 32);
    expect(transformY(s.transform)).toBeCloseTo(1.536, 5);
    expect(String(s.transform)).toContain("scale(2)");
  });

  it("저장된 icon_y 오프셋은 박스 비례로 반영한다(scale 1일 때 보정 0)", () => {
    // icon_y 10 @ box 44, scale 1 → 10 * (44/100) + 0 = 4.4px.
    const s = orgIconStyle({ icon_scale: 100, icon_x: 0, icon_y: 10 }, 44);
    expect(transformY(s.transform)).toBeCloseTo(4.4, 5);
  });
});
