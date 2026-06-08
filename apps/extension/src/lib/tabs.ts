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
