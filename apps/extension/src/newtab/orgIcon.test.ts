import { describe, it, expect } from "vitest";
import { orgIconStyle, ORG_ICON_FONT } from "./orgIcon";

describe("orgIconStyle", () => {
  it("이모지 폰트 스택을 Tossface 1순위로 적용한다", () => {
    const s = orgIconStyle({ icon_scale: 100, icon_x: 0, icon_y: 0 }, 32);
    expect(s.fontFamily).toBe(ORG_ICON_FONT);
    expect(ORG_ICON_FONT).toMatch(/^"Tossface"/);
  });
  it("박스 비례 폰트 크기(0.57)를 유지한다", () => {
    const s = orgIconStyle({}, 100);
    expect(s.fontSize).toBeCloseTo(57, 5);
  });

  it("폰트 크기를 반올림하지 않는다(렌더 지점 간 baseline 정확 일치)", () => {
    // 헤더 박스 28 → 15.96. 반올림하면 16이 되어 렌더 지점 정렬이 어긋난다(커밋 f11cfc4 참고).
    const s = orgIconStyle({}, 28);
    expect(s.fontSize).toBeCloseTo(15.96, 5);
  });
});
