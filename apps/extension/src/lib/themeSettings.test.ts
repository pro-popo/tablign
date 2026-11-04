import { describe, it, expect, beforeEach } from "vitest";
import { normalizeTheme, DEFAULT_THEME, accentHex, isDarkTheme, readThemeCache, writeThemeCache, THEME_CACHE_KEY, ACCENT_PRESETS, SAMPLE_PHOTOS } from "./themeSettings";

describe("normalizeTheme", () => {
  it("빈 값·이상한 값은 처음 값으로", () => {
    expect(normalizeTheme(null)).toEqual(DEFAULT_THEME);
    expect(normalizeTheme("x")).toEqual(DEFAULT_THEME);
    expect(normalizeTheme({})).toEqual(DEFAULT_THEME);
    expect(DEFAULT_THEME.mode).toBe("light");
    expect(DEFAULT_THEME.background.kind).toBe("none");
    expect(DEFAULT_THEME.glass).toBe(30);
  });

  it("맞는 값은 그대로, 범위 밖은 잘라낸다", () => {
    const s = normalizeTheme({
      v: 1, mode: "dark", accent: { custom: "#abc" }, glass: 120,
      background: {
        kind: "gradient", solid: "#FEDFE2",
        gradient: { type: "radial", points: [[-5, 50], [200, 30]], stops: [{ color: "#FFD8C2", pos: 100 }, { color: "#bac8ff", pos: 0 }] },
        photo: { source: "upload", path: "u/1.jpg", veil: 99 },
      },
    });
    expect(s.mode).toBe("dark");
    expect(s.accent).toEqual({ custom: "#AABBCC" });
    expect(s.glass).toBe(80);
    expect(s.background.kind).toBe("gradient");
    expect(s.background.gradient.points).toEqual([[0, 50], [100, 30]]);
    // 위치 순서로 정렬
    expect(s.background.gradient.stops.map((x) => x.color)).toEqual(["#BAC8FF", "#FFD8C2"]);
    expect(s.background.photo).toEqual({ source: "upload", path: "u/1.jpg", veil: 80 });
  });

  it("색이 2~4개가 아니면 처음 색으로", () => {
    const one = normalizeTheme({ background: { gradient: { type: "linear", points: [[0, 0], [100, 100]], stops: [{ color: "#ffffff", pos: 0 }] } } });
    expect(one.background.gradient.stops).toHaveLength(2);
    const five = normalizeTheme({ background: { gradient: { type: "linear", points: [[0, 0], [100, 100]], stops: [0, 20, 40, 60, 100].map((pos) => ({ color: "#ffffff", pos })) } } });
    expect(five.background.gradient.stops).toHaveLength(2);
  });

  it("없는 프리셋 번호는 기본 강조색", () => {
    expect(normalizeTheme({ accent: { preset: 99 } }).accent).toEqual({ preset: 0 });
    expect(normalizeTheme({ accent: { preset: 3 } }).accent).toEqual({ preset: 3 });
  });
});

describe("accentHex / isDarkTheme", () => {
  it("프리셋·직접 고른 색", () => {
    expect(accentHex(DEFAULT_THEME)).toBe(ACCENT_PRESETS[0].hex);
    expect(accentHex({ ...DEFAULT_THEME, accent: { preset: 2 } })).toBe(ACCENT_PRESETS[2].hex);
    expect(accentHex({ ...DEFAULT_THEME, accent: { custom: "#123456" } })).toBe("#123456");
  });
  it("시스템이면 기기 설정을 따른다", () => {
    expect(isDarkTheme({ ...DEFAULT_THEME, mode: "system" }, true)).toBe(true);
    expect(isDarkTheme({ ...DEFAULT_THEME, mode: "system" }, false)).toBe(false);
    expect(isDarkTheme({ ...DEFAULT_THEME, mode: "dark" }, false)).toBe(true);
    expect(isDarkTheme({ ...DEFAULT_THEME, mode: "light" }, true)).toBe(false);
  });
});

describe("캐시", () => {
  beforeEach(() => localStorage.clear());
  it("없거나 깨졌으면 처음 값", () => {
    expect(readThemeCache()).toEqual(DEFAULT_THEME);
    localStorage.setItem(THEME_CACHE_KEY, "{oops");
    expect(readThemeCache()).toEqual(DEFAULT_THEME);
  });
  it("쓴 값을 그대로 읽는다", () => {
    const s = { ...DEFAULT_THEME, mode: "dark" as const };
    writeThemeCache(s);
    expect(readThemeCache()).toEqual(s);
  });
});

describe("예시 사진", () => {
  it("계절 순으로 놓이고, 목록에 있는 예시만 받는다", () => {
    expect(Object.values(SAMPLE_PHOTOS).map((p) => p.name)).toEqual(["벚꽃", "바다", "산", "노을", "운해", "설경", "오로라", "밤하늘"]);
    const withSource = (source: unknown) => normalizeTheme({ background: { kind: "photo", photo: { source } } }).background.photo.source;
    expect(withSource("aurora")).toBe("aurora");
    expect(withSource("upload")).toBe("upload");
    // 예전에 있다가 빠진 예시(모래언덕 등)나 모르는 값은 처음 예시로
    expect(withSource("dunes")).toBe(DEFAULT_THEME.background.photo.source);
  });
});
