import { describe, it, expect } from "vitest";
import { parseColorValue, buildColorValue, DEFAULT_COLOR_VALUE } from "../colorValue";

describe("parseColorValue", () => {
  it("단색 hex", () => {
    expect(parseColorValue("#748FFC")).toEqual({ kind: "solid", hex: "#748FFC" });
  });
  it("3자리 hex도 정규화", () => {
    expect(parseColorValue("#abc")).toEqual({ kind: "solid", hex: "#AABBCC" });
  });
  it("퍼센트 없는 그라데이션은 0/100", () => {
    expect(parseColorValue("linear-gradient(135deg, #748FFC, #9775FA)")).toEqual({
      kind: "gradient", start: "#748FFC", end: "#9775FA", startPos: 0, endPos: 100,
    });
  });
  it("퍼센트 있는 그라데이션", () => {
    expect(parseColorValue("linear-gradient(135deg, #748FFC 55%, #9775FA 100%)")).toEqual({
      kind: "gradient", start: "#748FFC", end: "#9775FA", startPos: 55, endPos: 100,
    });
  });
  it("null·불량 입력은 기본 단색", () => {
    expect(parseColorValue(null)).toEqual(DEFAULT_COLOR_VALUE);
    expect(parseColorValue("garbage")).toEqual(DEFAULT_COLOR_VALUE);
  });
});

describe("buildColorValue", () => {
  it("단색", () => {
    expect(buildColorValue({ kind: "solid", hex: "#748FFC" })).toBe("#748FFC");
  });
  it("균등 그라데이션은 퍼센트 생략", () => {
    expect(buildColorValue({ kind: "gradient", start: "#748FFC", end: "#9775FA", startPos: 0, endPos: 100 }))
      .toBe("linear-gradient(135deg, #748FFC, #9775FA)");
  });
  it("비율 그라데이션은 퍼센트 포함", () => {
    expect(buildColorValue({ kind: "gradient", start: "#748FFC", end: "#9775FA", startPos: 55, endPos: 100 }))
      .toBe("linear-gradient(135deg, #748FFC 55%, #9775FA 100%)");
  });
  it("시작=끝 그라데이션은 단색으로 정규화", () => {
    expect(buildColorValue({ kind: "gradient", start: "#748FFC", end: "#748FFC", startPos: 0, endPos: 100 }))
      .toBe("#748FFC");
  });
  it("parse→build 왕복", () => {
    const s = "linear-gradient(135deg, #748FFC 30%, #9775FA 80%)";
    expect(buildColorValue(parseColorValue(s))).toBe(s);
  });
});
