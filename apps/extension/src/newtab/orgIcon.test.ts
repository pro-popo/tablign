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

  it("기본값(offset 0)에서 세로 보정 없이 transform y=0 이다(힌팅이 소형에서 중앙 스냅)", () => {
    // 세로 nudge를 두지 않는다 — 레일·헤더(28·32px)에서 nudge가 오히려 어긋나게 했다.
    const s = orgIconStyle({ icon_scale: 100, icon_x: 0, icon_y: 0 }, 44);
    expect(s.transform).toBe("translate(0px, 0px) scale(1)");
  });

  it("저장된 icon_y 오프셋은 박스 비례로 반영한다", () => {
    // icon_y 10 @ box 44 → 10 * (44/100) = 4.4px.
    const s = orgIconStyle({ icon_scale: 100, icon_x: 0, icon_y: 10 }, 44);
    expect(s.transform).toBe("translate(0px, 4.4px) scale(1)");
  });
});
