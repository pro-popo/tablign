import { describe, expect, it } from "vitest";
import { faviconFor, isImportableUrl } from "../import/url";

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
