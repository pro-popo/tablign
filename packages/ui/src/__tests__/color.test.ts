import { describe, it, expect } from "vitest";
import { hexToHsv, hsvToHex, normalizeHex } from "../color";

describe("color 변환", () => {
  it("hsvToHex 기본색", () => {
    expect(hsvToHex(0, 1, 1)).toBe("#FF0000");
    expect(hsvToHex(120, 1, 1)).toBe("#00FF00");
    expect(hsvToHex(240, 1, 1)).toBe("#0000FF");
    expect(hsvToHex(0, 0, 1)).toBe("#FFFFFF");
    expect(hsvToHex(0, 0, 0)).toBe("#000000");
  });
  it("hexToHsv 왕복(roundtrip) 근사", () => {
    for (const hex of ["#FF0000", "#00FF00", "#3B5BDB", "#1E5AF0"]) {
      const hsv = hexToHsv(hex)!;
      expect(hsvToHex(hsv.h, hsv.s, hsv.v)).toBe(hex);
    }
  });
  it("hexToHsv 잘못된 입력은 null", () => {
    expect(hexToHsv("zzz")).toBeNull();
    expect(hexToHsv("#12")).toBeNull();
  });
  it("normalizeHex", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("3b5bdb")).toBe("#3B5BDB");
    expect(normalizeHex("#3B5BDB")).toBe("#3B5BDB");
    expect(normalizeHex("nope")).toBeNull();
  });
});
