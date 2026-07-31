import { isImportableUrl } from "./url";
import type { SourceNode } from "./types";

// 가져오기는 Chrome 북마크를 **읽기만** 한다. 생성·수정·삭제 코드는 이 저장소 어디에도 없다.
// manifest의 bookmarks 권한이 설치 화면에 "읽기 및 변경"으로 표시되는 것은
// Chrome에 읽기 전용 북마크 권한이 존재하지 않기 때문이다.

/** Chrome 북마크바의 고정 id. */
export const CHROME_BOOKMARKS_BAR_ID = "1";

/** chrome.bookmarks.BookmarkTreeNode에서 우리가 쓰는 부분만. */
export interface ChromeBookmarkNode {
  id: string;
  title: string;
  url?: string;
  children?: ChromeBookmarkNode[];
}

/** 링크·자손이 하나도 없는 폴더를 걷어내며 SourceNode로 바꾼다. 없으면 null. */
function convert(node: ChromeBookmarkNode): SourceNode | null {
  if (node.url !== undefined) {
    // 탭으로 열 수 없는 주소는 애초에 세지 않는다 — 나중에 조용히 사라지면 안 된다
    return isImportableUrl(node.url) ? { id: node.id, title: node.title, url: node.url } : null;
  }
  const children = (node.children ?? [])
    .map(convert)
    .filter((n): n is SourceNode => n !== null);
  if (!children.length) return null;
  return { id: node.id, title: node.title, children };
}

/**
 * Chrome 루트의 자식들(북마크바·기타 북마크·모바일 북마크)을 정규화한다.
 * chrome.bookmarks.getTree()[0].children를 그대로 넘기면 된다.
 */
export function fromChromeTree(nodes: ChromeBookmarkNode[]): SourceNode[] {
  const roots: SourceNode[] = [];
  for (const node of nodes) {
    const converted = convert(node);
    if (!converted) continue;
    roots.push(
      node.id === CHROME_BOOKMARKS_BAR_ID ? { ...converted, primary: true } : converted,
    );
  }
  return roots;
}
