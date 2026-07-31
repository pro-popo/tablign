import { faviconFor, normalizeUrl } from "./url";
import type {
  ImportConfig, ImportPlan, PlannedCollection, PlannedLink, PlannedSpace, SourceNode,
} from "./types";

// 타입은 ./types가 단일 출처다. 여기서 재수출하면 index.ts가 두 모듈을
// 모두 export할 때 같은 이름이 두 번 나와 TS2308이 난다.

/** 폴더에 직접 들어있던 링크가 모이는 컬렉션 이름. */
export const SHARED_COLLECTION_TITLE = "공유 폴더";
/** 한 번에 가져올 수 있는 링크 상한. */
export const MAX_IMPORT_LINKS = 2000;
/** 이 개수를 넘는 1단 폴더는 기본 해제("나중에 읽기" 같은 묘지). */
export const LARGE_FOLDER_THRESHOLD = 100;

/** 루트 직속 링크 묶음은 실제 폴더가 아니므로 합성 id를 쓴다. */
export function looseSourceId(rootId: string): string {
  return `${rootId}:loose`;
}

/** 자손을 포함한 링크 수. */
export function countLinks(node: SourceNode): number {
  let n = 0;
  for (const c of node.children ?? []) {
    if (c.url !== undefined) n += 1;
    else n += countLinks(c);
  }
  return n;
}

const isFolder = (n: SourceNode) => n.url === undefined;

/** 폴더의 직속 링크를 가져오며 중복을 소비한다. seen에 이미 있으면 버리고 센다. */
function takeLinks(folder: SourceNode, seen: Set<string>): { links: PlannedLink[]; dropped: number } {
  const links: PlannedLink[] = [];
  let dropped = 0;
  for (const child of folder.children ?? []) {
    if (child.url === undefined) continue;
    const key = normalizeUrl(child.url);
    if (seen.has(key)) { dropped += 1; continue; }
    seen.add(key);
    links.push({ url: child.url, title: child.title || null, favicon_url: faviconFor(child.url) });
  }
  return { links, dropped };
}

/**
 * 스페이스 폴더 하나가 갖게 될 컬렉션들.
 * 직속 링크(공유 폴더)를 먼저 선점하고, 자손 폴더를 깊이 우선으로 훑는다.
 * 출력 순서는 자손 폴더들 → 공유 폴더(맨 뒤)다.
 */
function collectCollections(
  spaceFolder: SourceNode, seen: Set<string>, config: ImportConfig,
): PlannedCollection[] {
  const own = takeLinks(spaceFolder, seen);
  const out: PlannedCollection[] = [];

  const walk = (folder: SourceNode, prefix: string) => {
    for (const child of folder.children ?? []) {
      if (!isFolder(child)) continue;
      // 스페이스 폴더 기준 상대 경로 전체 — 경로는 유일하므로 이름이 충돌하지 않는다
      const title = prefix ? `${prefix}/${child.title}` : child.title;
      if (config.enabled[child.id]) {
        const { links, dropped } = takeLinks(child, seen);
        if (links.length) {
          out.push({ sourceId: child.id, title, synthetic: prefix !== "", links, duplicatesDropped: dropped });
        }
      }
      // 부모가 꺼져 있어도 자손은 독립적으로 켤 수 있다
      walk(child, title);
    }
  };
  walk(spaceFolder, "");

  if (own.links.length) {
    out.push({
      sourceId: spaceFolder.id, title: SHARED_COLLECTION_TITLE, synthetic: true,
      links: own.links, duplicatesDropped: own.dropped,
    });
  }
  return out;
}

function tally(spaces: PlannedSpace[]): ImportPlan["totals"] {
  let collections = 0, links = 0, duplicates = 0;
  for (const s of spaces) {
    for (const c of s.collections) {
      collections += 1;
      links += c.links.length;
      duplicates += c.duplicatesDropped;
    }
  }
  return { spaces: spaces.length, collections, links, duplicates };
}

/**
 * 소스 트리 + 선택 상태 → 만들어질 스페이스·컬렉션·링크 계획.
 * 미리보기와 실제 삽입이 같은 결과를 쓰도록 부수효과를 두지 않는다.
 */
export function planImport(roots: SourceNode[], config: ImportConfig): ImportPlan {
  const seen = new Set<string>();
  const spaces: PlannedSpace[] = [];

  for (const root of roots) {
    // 1단 폴더 = 스페이스 (children 순서를 유지해 중복 선점 순서를 예측 가능하게 둔다)
    for (const child of root.children ?? []) {
      if (!isFolder(child)) continue;
      if (!config.enabled[child.id]) continue;
      const collections = collectCollections(child, seen, config);
      if (collections.length) {
        spaces.push({ sourceId: child.id, name: child.title, collections });
      }
    }
    // 루트 직속 링크 → 루트 이름의 스페이스. 폴더들 뒤에 붙는다.
    const looseId = looseSourceId(root.id);
    if (config.enabled[looseId]) {
      const { links, dropped } = takeLinks(root, seen);
      if (links.length) {
        spaces.push({
          sourceId: looseId, name: root.title,
          collections: [{
            sourceId: looseId, title: SHARED_COLLECTION_TITLE, synthetic: true,
            links, duplicatesDropped: dropped,
          }],
        });
      }
    }
  }

  return { spaces, totals: tally(spaces) };
}

/**
 * 다이얼로그가 열린 순간의 체크 상태.
 * - 사용자가 매일 보는 루트(primary, Chrome의 북마크바) 아래만 기본으로 켠다.
 *   나머지 루트(기타 북마크·모바일 북마크)는 사실상 창고다.
 * - 자손 포함 링크가 LARGE_FOLDER_THRESHOLD를 넘는 1단 폴더는 끈다.
 *   대개 "나중에 읽기" 같은 묘지라서, 켜면 첫 보드가 못 쓰게 된다.
 */
export function defaultEnabled(roots: SourceNode[]): Record<string, boolean> {
  const enabled: Record<string, boolean> = {};

  for (const root of roots) {
    const primary = root.primary === true;

    for (const child of root.children ?? []) {
      if (!isFolder(child)) continue;
      const on = primary && countLinks(child) <= LARGE_FOLDER_THRESHOLD;
      // 1단 폴더와 그 자손은 같은 기본값을 갖는다(스페이스를 끄면 안쪽도 꺼진 상태로 시작)
      const mark = (n: SourceNode) => {
        enabled[n.id] = on;
        for (const g of n.children ?? []) if (isFolder(g)) mark(g);
      };
      mark(child);
    }
    enabled[looseSourceId(root.id)] = primary;
  }

  return enabled;
}
