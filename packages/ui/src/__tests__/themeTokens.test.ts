import { describe, it, expect } from "vitest";
import { computeTokens, tokenVars, applyTokens, contrast, withBackground, DEFAULT_ACCENT, LIGHT, DARK } from "../themeTokens";
import { defaultGradient } from "../gradient";
import { theme } from "../theme";

describe("computeTokens", () => {
  it("라이트 + 기본 강조색은 지금 화면 색과 같다", () => {
    const t = computeTokens({ dark: false, accent: DEFAULT_ACCENT });
    expect(t).toMatchObject({
      accent: "#3b5bdb", accentWeak: "#edf0fe", accentSoft: "#e4e9fd", accentTint: "#c9d4ff", accentInk: "#3b5bdb", onAccent: "#ffffff",
      text: "#1f2430", textMuted: "#868e96", textFaint: "#adb5bd", border: "#eaecef", borderCard: "#e9ebee",
      bg: "#fcfcfd", surface: "#ffffff", surface2: "#f1f3f5", danger: "#e03131", greenDeep: "#2f9e63",
    });
  });

  it("다크는 다크 색표를 쓴다", () => {
    const t = computeTokens({ dark: true, accent: DEFAULT_ACCENT });
    expect(t.bg).toBe(DARK.bg);
    expect(t.text).toBe(DARK.text);
    expect(t.surface).toBe(DARK.surface);
    expect(t.accent).toBe("#3b5bdb");
    // 다크 바탕 위 강조 글자는 읽히게 밝힌다
    expect(contrast(t.accentInk, t.accentWeak)).toBeGreaterThanOrEqual(4.5);
  });

  it("밝은 강조색이면 버튼 글자를 어둡게, 강조 글자는 읽히게 어둡게", () => {
    const t = computeTokens({ dark: false, accent: "#FFD43B" });
    expect(t.onAccent).toBe(LIGHT.text);
    expect(contrast(t.accentInk, t.accentWeak)).toBeGreaterThanOrEqual(4.5);
    expect(t.accentWeak).not.toBe("#edf0fe");
  });

  it("잘못된 강조색은 기본 강조색으로", () => {
    expect(computeTokens({ dark: false, accent: "nope" }).accent).toBe("#3b5bdb");
  });
});

describe("tokenVars / applyTokens", () => {
  it("--tb-이름(케밥) 변수로 바꾸고 문서에 넣는다", () => {
    const t = computeTokens({ dark: false, accent: DEFAULT_ACCENT });
    const vars = tokenVars(t);
    expect(vars["--tb-accent-weak"]).toBe("#edf0fe");
    expect(vars["--tb-on-accent"]).toBe("#ffffff");
    const el = document.createElement("div");
    applyTokens(el, t);
    expect(el.style.getPropertyValue("--tb-surface2")).toBe(t.surface2);
  });

  it("theme의 색은 같은 이름의 변수를 가리킨다", () => {
    expect(theme.accent).toBe("var(--tb-accent)");
    expect(theme.accentWeak).toBe("var(--tb-accent-weak)");
    expect(theme.surface2).toBe("var(--tb-surface2)");
    expect(theme.radiusCard).toBe(9);
    const keys = Object.keys(tokenVars(computeTokens({ dark: false, accent: DEFAULT_ACCENT })));
    for (const [k, v] of Object.entries(theme)) {
      if (typeof v === "string" && v.startsWith("var(")) expect(keys).toContain(v.slice(4, -1));
      else expect(k).toMatch(/^radius|iconFont/);
    }
  });
});


describe("withBackground", () => {
  const base = computeTokens({ dark: false, accent: DEFAULT_ACCENT });
  it("배경이 없으면 그대로(판은 원래 바탕, 컬렉션 판 없음)", () => {
    expect(withBackground(base, { kind: "none" }, 30, [1000, 800], false)).toBe(base);
    expect(base.page).toBe(base.bg);
    expect(base.paneCol).toBe("transparent");
    expect(base.paneBlur).toBe("none");
  });
  it("배경이 있으면 판이 투명도만큼 비치고 흐려진다", () => {
    const t = withBackground(base, { kind: "solid", color: "#E9E4FE" }, 30, [1000, 800], false);
    expect(t.page).toBe("#E9E4FE");
    expect(t.pane).toBe("rgba(255,255,255,0.7)");
    expect(t.paneRail).toBe("rgba(245,246,248,0.7)");
    expect(t.paneCol).toBe("rgba(255,255,255,0.7)");
    expect(t.paneBlur).toBe("blur(16px)");
    expect(t.boardInk).toBe(base.text);
  });
  it("진한 배경이면 배경 위 글자를 밝게", () => {
    const t = withBackground(base, { kind: "solid", color: "#1B1F3B" }, 30, [1000, 800], false);
    expect(t.boardInk).toBe(DARK.text);
  });
  it("그라데이션·사진", () => {
    expect(withBackground(base, { kind: "gradient", gradient: defaultGradient() }, 0, [1000, 800], false).page).toMatch(/^linear-gradient\(/);
    const dark = computeTokens({ dark: true, accent: DEFAULT_ACCENT });
    const p = withBackground(dark, { kind: "photo", url: "backgrounds/sea.svg", veil: 35 }, 30, [1000, 800], true);
    expect(p.page).toBe('linear-gradient(rgba(12,14,18,0.35),rgba(12,14,18,0.35)), url("backgrounds/sea.svg") center / cover no-repeat');
    expect(withBackground(base, { kind: "photo", url: null, veil: 35 }, 30, [1000, 800], false)).toBe(base);
  });
});
