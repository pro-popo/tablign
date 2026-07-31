import { describe, expect, it } from "vitest";
import { normalizeUrl, faviconFor, isImportableUrl } from "../import/url";

describe("normalizeUrl", () => {
  it("프래그먼트를 제거한다", () => {
    expect(normalizeUrl("https://react.dev/learn#state")).toBe("https://react.dev/learn");
  });
  it("경로 끝 슬래시를 제거한다", () => {
    expect(normalizeUrl("https://react.dev/learn/")).toBe("https://react.dev/learn");
  });
  it("루트 경로의 슬래시는 남긴다", () => {
    expect(normalizeUrl("https://react.dev/")).toBe("https://react.dev/");
  });
  it("쿼리스트링은 건드리지 않는다", () => {
    expect(normalizeUrl("https://a.com/b?utm_source=x")).toBe("https://a.com/b?utm_source=x");
  });
  it("쿼리가 다르면 다른 키다", () => {
    expect(normalizeUrl("https://a.com/b?x=1")).not.toBe(normalizeUrl("https://a.com/b?x=2"));
  });
  it("프래그먼트만 다른 두 주소는 같은 키가 된다", () => {
    expect(normalizeUrl("https://a.com/b#one")).toBe(normalizeUrl("https://a.com/b#two"));
  });
  it("파싱할 수 없는 값은 원문을 그대로 키로 쓴다", () => {
    expect(normalizeUrl("완전히 주소가 아님")).toBe("완전히 주소가 아님");
  });
});

describe("faviconFor", () => {
  it("origin 기준 favicon.ico를 만든다", () => {
    expect(faviconFor("https://react.dev/learn/state")).toBe("https://react.dev/favicon.ico");
  });
  it("포트가 있으면 origin에 포함된다", () => {
    expect(faviconFor("http://localhost:5173/a")).toBe("http://localhost:5173/favicon.ico");
  });
  it("http·https가 아니면 null", () => {
    expect(faviconFor("javascript:alert(1)")).toBeNull();
    expect(faviconFor("chrome://bookmarks")).toBeNull();
  });
  it("파싱 실패면 null", () => {
    expect(faviconFor("주소 아님")).toBeNull();
  });
});

describe("isImportableUrl", () => {
  it("http·https만 통과한다", () => {
    expect(isImportableUrl("https://a.com")).toBe(true);
    expect(isImportableUrl("http://a.com")).toBe(true);
    expect(isImportableUrl("javascript:void(0)")).toBe(false);
    expect(isImportableUrl("chrome://newtab")).toBe(false);
    expect(isImportableUrl("file:///Users/a.pdf")).toBe(false);
    expect(isImportableUrl("주소 아님")).toBe(false);
  });
});
