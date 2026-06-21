import type { CreateLinkInput } from "@tablign/core";

export interface TabLike {
  url?: string;
  title?: string;
  favIconUrl?: string;
}

function isHttp(url: string | undefined): url is string {
  return !!url && (url.startsWith("http://") || url.startsWith("https://"));
}

export function tabsToLinkInputs(
  tabs: TabLike[],
  userId: string,
  collectionId: string,
): CreateLinkInput[] {
  return tabs
    .filter((t) => isHttp(t.url))
    .map((t) => ({
      user_id: userId,
      collection_id: collectionId,
      url: t.url!,
      title: t.title ?? null,
      favicon_url: t.favIconUrl ?? null,
    }));
}

export interface WindowTab {
  id?: number;
  windowId?: number;
  url?: string;
  title?: string;
  favIconUrl?: string;
}

export interface WindowGroup {
  windowId: number;
  tabs: WindowTab[];
}

/**
 * OPEN TABS에서 드래그한 탭을 컬렉션 섹션에 드롭했을 때 저장할 링크 입력을 만든다.
 * 탭이 없거나 드롭 대상이 없거나 비-http(s) 탭이면 null.
 */
export function tabDropToLinkInput(
  tab: WindowTab | undefined,
  collectionId: string | undefined,
  userId: string,
): CreateLinkInput | null {
  if (!tab || !collectionId) return null;
  const [input] = tabsToLinkInputs([tab], userId, collectionId);
  return input ?? null;
}

export function groupTabsByWindow(tabs: WindowTab[]): WindowGroup[] {
  const order: number[] = [];
  const map = new Map<number, WindowTab[]>();
  for (const tab of tabs) {
    const wid = tab.windowId ?? 0;
    if (!map.has(wid)) {
      map.set(wid, []);
      order.push(wid);
    }
    map.get(wid)!.push(tab);
  }
  return order.map((windowId) => ({ windowId, tabs: map.get(windowId)! }));
}

/**
 * 드래그 중 groups 상태에서 탭을 재배치한다(순수).
 * 같은 창이면 splice로 재정렬, 다른 창이면 원본에서 제거 후 대상 창의 toIndex에 삽입한다.
 * toIndex는 0-based 삽입 위치이며 범위를 벗어나면 클램프한다.
 * 옮길 탭이 없거나 대상 창이 없으면 원본 배열을 그대로 반환한다.
 */
export function moveTab(
  groups: WindowGroup[],
  tabId: number,
  toWindowId: number,
  toIndex: number,
): WindowGroup[] {
  if (!groups.some((g) => g.windowId === toWindowId)) return groups;
  let from: { windowId: number; index: number; tab: WindowTab } | null = null;
  for (const g of groups) {
    const index = g.tabs.findIndex((t) => t.id === tabId);
    if (index >= 0) { from = { windowId: g.windowId, index, tab: g.tabs[index] }; break; }
  }
  if (!from) return groups;

  if (from.windowId === toWindowId) {
    return groups.map((g) => {
      if (g.windowId !== toWindowId) return g;
      const tabs = [...g.tabs];
      const [item] = tabs.splice(from!.index, 1);
      const idx = Math.max(0, Math.min(toIndex, tabs.length));
      tabs.splice(idx, 0, item);
      return { ...g, tabs };
    });
  }

  const moving: WindowTab = { ...from.tab, windowId: toWindowId };
  return groups.map((g) => {
    if (g.windowId === from!.windowId) return { ...g, tabs: g.tabs.filter((t) => t.id !== tabId) };
    if (g.windowId === toWindowId) {
      const idx = Math.max(0, Math.min(toIndex, g.tabs.length));
      return { ...g, tabs: [...g.tabs.slice(0, idx), moving, ...g.tabs.slice(idx)] };
    }
    return g;
  });
}
