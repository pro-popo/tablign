import { describe, expect, it } from "vitest";
import { tabsToLinkInputs, tabDropToLinkInput, moveTab, parseTabDragId, resolveTabDropTarget } from "./tabs";
import { isSaveableTab, saveableTabs, unsaveableReason } from "./tabs";
import { groupTabsByWindow, type WindowTab, type WindowGroup } from "./tabs";

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

describe("groupTabsByWindow", () => {
  const tabs: WindowTab[] = [
    { id: 1, windowId: 10, url: "https://a.com", title: "A", favIconUrl: undefined },
    { id: 2, windowId: 10, url: "https://b.com", title: "B", favIconUrl: undefined },
    { id: 3, windowId: 20, url: "https://c.com", title: "C", favIconUrl: undefined },
  ];

  it("windowId 별로 그룹화하고 순서를 유지한다", () => {
    const groups = groupTabsByWindow(tabs);
    expect(groups).toHaveLength(2);
    expect(groups[0].windowId).toBe(10);
    expect(groups[0].tabs.map((t) => t.id)).toEqual([1, 2]);
    expect(groups[1].windowId).toBe(20);
    expect(groups[1].tabs.map((t) => t.id)).toEqual([3]);
  });
});

describe("tabDropToLinkInput", () => {
  it("드롭 대상(collectionId)이 없으면 null", () => {
    expect(tabDropToLinkInput({ url: "https://a.com" }, undefined, "u1")).toBeNull();
  });

  it("드래그한 탭이 없으면 null", () => {
    expect(tabDropToLinkInput(undefined, "c1", "u1")).toBeNull();
  });

  it("http(s) 탭은 링크 입력으로 매핑한다", () => {
    const input = tabDropToLinkInput(
      { url: "https://a.com", title: "A", favIconUrl: "https://a.com/f.ico" },
      "c1",
      "u1",
    );
    expect(input).toMatchObject({
      user_id: "u1",
      collection_id: "c1",
      url: "https://a.com",
      title: "A",
      favicon_url: "https://a.com/f.ico",
    });
  });

  it("chrome:// 같은 비-http 탭은 null", () => {
    expect(tabDropToLinkInput({ url: "chrome://extensions" }, "c1", "u1")).toBeNull();
  });
});

describe("moveTab", () => {
  const groups: WindowGroup[] = [
    { windowId: 10, tabs: [
      { id: 1, windowId: 10, url: "https://a.com", title: "A" },
      { id: 2, windowId: 10, url: "https://b.com", title: "B" },
      { id: 3, windowId: 10, url: "https://c.com", title: "C" },
    ] },
    { windowId: 20, tabs: [
      { id: 4, windowId: 20, url: "https://d.com", title: "D" },
    ] },
  ];

  it("같은 창 내에서 앞→뒤로 재정렬한다", () => {
    const r = moveTab(groups, 1, 10, 2);
    expect(r[0].tabs.map((t) => t.id)).toEqual([2, 3, 1]);
    expect(r[1].tabs.map((t) => t.id)).toEqual([4]);
  });

  it("같은 창 내에서 뒤→앞으로 재정렬한다", () => {
    const r = moveTab(groups, 3, 10, 0);
    expect(r[0].tabs.map((t) => t.id)).toEqual([3, 1, 2]);
  });

  it("다른 창의 특정 index로 이동하고 windowId를 갱신한다", () => {
    const r = moveTab(groups, 1, 20, 0);
    expect(r[0].tabs.map((t) => t.id)).toEqual([2, 3]);
    expect(r[1].tabs.map((t) => t.id)).toEqual([1, 4]);
    expect(r[1].tabs.find((t) => t.id === 1)?.windowId).toBe(20);
  });

  it("대상 창의 끝(길이 이상 index)으로 이동한다", () => {
    const r = moveTab(groups, 1, 20, 99);
    expect(r[1].tabs.map((t) => t.id)).toEqual([4, 1]);
  });

  it("탭/대상 창이 없으면 원본을 그대로 반환한다", () => {
    expect(moveTab(groups, 999, 10, 0)).toBe(groups);
    expect(moveTab(groups, 1, 999, 0)).toBe(groups);
  });
});

describe("parseTabDragId", () => {
  it("tab-123 → 123", () => {
    expect(parseTabDragId("tab-123")).toBe(123);
  });
  it("tab 접두사가 아니면 null", () => {
    expect(parseTabDragId("container:abc")).toBeNull();
    expect(parseTabDragId("window:10")).toBeNull();
  });
  it("숫자가 아니면 null", () => {
    expect(parseTabDragId("tab-abc")).toBeNull();
  });
});

describe("resolveTabDropTarget", () => {
  const groups: WindowGroup[] = [
    { windowId: 10, tabs: [
      { id: 1, windowId: 10, url: "https://a.com" },
      { id: 2, windowId: 10, url: "https://b.com" },
    ] },
    { windowId: 20, tabs: [] },
  ];

  it("window:{wid}는 해당 창의 끝 index를 돌려준다", () => {
    expect(resolveTabDropTarget(groups, "window:10")).toEqual({ toWindowId: 10, toIndex: 2 });
    expect(resolveTabDropTarget(groups, "window:20")).toEqual({ toWindowId: 20, toIndex: 0 });
  });

  it("tab-{id}는 그 탭이 속한 창과 그 탭의 index를 돌려준다", () => {
    expect(resolveTabDropTarget(groups, "tab-2")).toEqual({ toWindowId: 10, toIndex: 1 });
  });

  it("컬렉션 대상(container:/링크 id)이면 null", () => {
    expect(resolveTabDropTarget(groups, "container:c1")).toBeNull();
    expect(resolveTabDropTarget(groups, "some-link-uuid")).toBeNull();
  });

  it("존재하지 않는 창/탭이면 null", () => {
    expect(resolveTabDropTarget(groups, "window:999")).toBeNull();
    expect(resolveTabDropTarget(groups, "tab-999")).toBeNull();
  });
});

describe("담을 수 있는 탭 판정", () => {
  it("http(s)만 담을 수 있다", () => {
    expect(isSaveableTab({ url: "https://a.com" })).toBe(true);
    expect(isSaveableTab({ url: "http://localhost:3000" })).toBe(true);
  });

  it("브라우저 내부 페이지·로컬 파일·url 없음은 담을 수 없다", () => {
    // tablign 새 탭 자신(chrome_url_overrides.newtab)
    expect(isSaveableTab({ url: "chrome-extension://abc/newtab.html" })).toBe(false);
    expect(isSaveableTab({ url: "chrome://settings" })).toBe(false);
    expect(isSaveableTab({ url: "file:///Users/me/doc.pdf" })).toBe(false);
    expect(isSaveableTab({ url: "about:blank" })).toBe(false);
    expect(isSaveableTab({ url: "data:text/html,x" })).toBe(false);
    expect(isSaveableTab({ url: "devtools://devtools/x.html" })).toBe(false);
    expect(isSaveableTab({ url: "" })).toBe(false);
    expect(isSaveableTab({})).toBe(false);
  });

  it("saveableTabs는 담을 수 있는 탭만 남기고 순서를 지킨다", () => {
    const list = [
      { url: "https://a.com" },
      { url: "chrome://settings" },
      { url: "https://b.com" },
      { url: "chrome-extension://abc/newtab.html" },
    ];
    expect(saveableTabs(list)).toEqual([{ url: "https://a.com" }, { url: "https://b.com" }]);
  });

  it("saveableTabs와 tabsToLinkInputs가 같은 기준을 쓴다 — 보이는 개수 ≠ 담기는 개수를 막는다", () => {
    const list = [
      { url: "https://a.com" },
      { url: "chrome://settings" },
      { url: "https://b.com" },
      { url: "file:///x.pdf" },
    ];
    expect(saveableTabs(list).length).toBe(tabsToLinkInputs(list, "u1", "c1").length);
  });

  it("담을 수 없는 이유는 스킴별로 갈린다", () => {
    expect(unsaveableReason({ url: "https://a.com" })).toBeNull();
    expect(unsaveableReason({ url: "file:///x.pdf" })).toBe("내 컴퓨터의 파일은 담을 수 없어요");
    expect(unsaveableReason({ url: "chrome://settings" })).toBe("브라우저 내부 페이지는 담을 수 없어요");
    expect(unsaveableReason({ url: "chrome-extension://abc/newtab.html" })).toBe("브라우저 내부 페이지는 담을 수 없어요");
  });
});
