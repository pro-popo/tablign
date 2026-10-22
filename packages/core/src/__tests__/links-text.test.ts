import { describe, expect, it } from "vitest";
import { linksToText } from "../links-text";

describe("linksToText", () => {
  it("제목은 custom_title 우선, 없으면 url만, 메모는 덧붙인다", () => {
    const text = linksToText("리서치", [
      { url: "https://a.com", title: "원래 제목", custom_title: "바꾼 제목", note: null },
      { url: "https://b.com", title: "B", custom_title: null, note: "핵심 자료" },
      { url: "https://c.com", title: null, custom_title: null, note: null },
    ]);
    expect(text).toBe(
      "# 리서치\n\n" +
      "바꾼 제목 | https://a.com\n" +
      "B | https://b.com | 핵심 자료\n" +
      "https://c.com\n",
    );
  });
});
