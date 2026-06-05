import { describe, expect, it } from "vitest";
import { tabsToLinkInputs } from "./tabs";

const tabs = [
  { url: "https://example.com", title: "예시", favIconUrl: "https://example.com/fav.ico" },
  { url: "chrome://extensions", title: "확장", favIconUrl: undefined },
  { url: "https://b.com", title: undefined, favIconUrl: undefined },
  { url: undefined, title: "no url", favIconUrl: undefined },
];

describe("tabsToLinkInputs", () => {
  it("http(s) 탭만 링크 입력으로 변환한다", () => {
    const inputs = tabsToLinkInputs(tabs, "u1", "c1");
    expect(inputs).toHaveLength(2);
    expect(inputs.map((i) => i.url)).toEqual(["https://example.com", "https://b.com"]);
  });

  it("user_id/collection_id/제목/파비콘을 매핑한다", () => {
    const inputs = tabsToLinkInputs(tabs, "u1", "c1");
    expect(inputs[0]).toMatchObject({
      user_id: "u1",
      collection_id: "c1",
      url: "https://example.com",
      title: "예시",
      favicon_url: "https://example.com/fav.ico",
    });
  });

  it("제목/파비콘이 없으면 null로 둔다", () => {
    const inputs = tabsToLinkInputs(tabs, "u1", "c1");
    expect(inputs[1].title).toBeNull();
    expect(inputs[1].favicon_url).toBeNull();
  });
});
