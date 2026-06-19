import { describe, it, expect } from "vitest";
import { extractCodeFromRedirect } from "./oauth";

describe("extractCodeFromRedirect", () => {
  it("쿼리스트링의 code를 추출", () => {
    expect(extractCodeFromRedirect("https://abc.chromiumapp.org/?code=xyz123")).toBe("xyz123");
  });
  it("code가 없으면 null", () => {
    expect(extractCodeFromRedirect("https://abc.chromiumapp.org/")).toBeNull();
  });
  it("redirectUrl이 undefined면 null", () => {
    expect(extractCodeFromRedirect(undefined)).toBeNull();
  });
});
