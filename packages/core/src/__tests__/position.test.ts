import { describe, expect, it } from "vitest";
import { positionBetween, GAP } from "../position";

describe("positionBetween", () => {
  it("앞뒤가 모두 없으면 기본 간격을 반환한다", () => {
    expect(positionBetween(undefined, undefined)).toBe(GAP);
  });

  it("맨 앞에 넣으면 다음 항목보다 GAP만큼 작다", () => {
    expect(positionBetween(undefined, 2000)).toBe(2000 - GAP);
  });

  it("맨 뒤에 넣으면 이전 항목보다 GAP만큼 크다", () => {
    expect(positionBetween(2000, undefined)).toBe(2000 + GAP);
  });

  it("두 항목 사이에 넣으면 중간값을 반환한다", () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
  });
});
