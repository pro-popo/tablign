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

  const transformY = (t: unknown) => Number(/translate\(0px, ([\d.]+)px\)/.exec(String(t))![1]);

  it("이모지 위쪽 치우침을 박스 비례로 아래로 보정한다(수직 nudge)", () => {
    // 44px 박스, scale 1 → y = 0 + 44*0.058*1 = 2.552px 아래로(실측 nudge 0.058).
    const s = orgIconStyle({ icon_scale: 100, icon_x: 0, icon_y: 0 }, 44);
    expect(transformY(s.transform)).toBeCloseTo(2.552, 5);
  });

  it("nudge는 scale에 비례한다(글리프가 커지면 치우침도 커짐)", () => {
    // scale 1.5 → y = 0 + 44*0.058*1.5 = 3.828px.
    const s = orgIconStyle({ icon_scale: 150, icon_x: 0, icon_y: 0 }, 44);
    expect(transformY(s.transform)).toBeCloseTo(3.828, 5);
    expect(String(s.transform)).toContain("scale(1.5)");
  });
});
