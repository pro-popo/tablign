import { describe, expect, it } from "vitest";
import { fromChromeTree, CHROME_BOOKMARKS_BAR_ID, type ChromeBookmarkNode } from "../import/chrome";

describe("fromChromeTree", () => {
  it("북마크바에 primary를 붙이고 나머지 루트에는 붙이지 않는다", () => {
    const roots = fromChromeTree([
      { id: CHROME_BOOKMARKS_BAR_ID, title: "북마크바", children: [{ id: "l", title: "A", url: "https://a.com" }] },
      { id: "2", title: "기타 북마크", children: [{ id: "l2", title: "B", url: "https://b.com" }] },
    ]);
    expect(roots[0].primary).toBe(true);
    expect(roots[1].primary).toBeUndefined();
  });

  it("http·https가 아닌 북마크를 제거한다", () => {
    const roots = fromChromeTree([{
      id: "1", title: "북마크바", children: [
        { id: "f", title: "F", children: [
          { id: "ok", title: "정상", url: "https://a.com" },
          { id: "js", title: "북마클릿", url: "javascript:alert(1)" },
          { id: "ch", title: "설정", url: "chrome://settings" },
        ]},
      ],
    }]);
    const folder = roots[0].children![0];
    expect(folder.children!.map((c) => c.id)).toEqual(["ok"]);
  });

  it("링크와 자손이 모두 없는 폴더를 제거한다", () => {
    const roots = fromChromeTree([{
      id: "1", title: "북마크바", children: [
        { id: "empty", title: "빈폴더", children: [] },
        { id: "onlyEmptyChild", title: "껍데기", children: [{ id: "e2", title: "안쪽빈폴더", children: [] }] },
        { id: "keep", title: "살아있음", children: [{ id: "l", title: "A", url: "https://a.com" }] },
      ],
    }]);
    expect(roots[0].children!.map((c) => c.id)).toEqual(["keep"]);
  });

  it("걸러낸 뒤 링크가 하나도 없는 루트는 제거한다", () => {
    const roots = fromChromeTree([
      { id: "1", title: "북마크바", children: [{ id: "l", title: "A", url: "https://a.com" }] },
      { id: "3", title: "모바일 북마크", children: [{ id: "js", title: "북마클릿", url: "javascript:void(0)" }] },
    ]);
    expect(roots.map((r) => r.id)).toEqual(["1"]);
  });

  it("중첩 구조와 순서를 그대로 유지한다", () => {
    const input: ChromeBookmarkNode[] = [{
      id: "1", title: "북마크바", children: [
        { id: "dev", title: "개발", children: [
          { id: "react", title: "React", children: [{ id: "l1", title: "A", url: "https://react.dev/a" }] },
          { id: "l2", title: "직속", url: "https://dev.local/x" },
        ]},
      ],
    }];
    const roots = fromChromeTree(input);
    const dev = roots[0].children![0];
    expect(dev.children!.map((c) => c.id)).toEqual(["react", "l2"]);
    expect(dev.children![0].children![0].url).toBe("https://react.dev/a");
  });
});
