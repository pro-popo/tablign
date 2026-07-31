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

const emptyBucket = (sourceId: string, title: string, synthetic: boolean): PlannedCollection =>
  ({ sourceId, title, synthetic, links: [], duplicatesDropped: 0 });

/** 링크 하나를 버킷에 담는다. 이미 본 URL이면 버리고 센다. bucket이 null이면(꺼진 폴더) 소비하지 않는다. */
function consumeLink(node: SourceNode, bucket: PlannedCollection | null, seen: Set<string>): void {
  if (!bucket) return;
  const key = normalizeUrl(node.url!);
  if (seen.has(key)) { bucket.duplicatesDropped += 1; return; }
  seen.add(key);
  bucket.links.push({ url: node.url!, title: node.title || null, favicon_url: faviconFor(node.url!) });
}

/**
 * 스페이스 폴더 하나가 갖게 될 컬렉션들.
 * 중복 선점은 **문서 순서(DFS)** 그대로다 — 사용자가 북마크에서 보는 순서상 먼저인 링크가 남는다.
 * 출력 순서는 자손 폴더들 → 공유 폴더(맨 뒤).
 * 링크가 전부 중복이라 만들어지지 않는 컬렉션의 버린 개수는 orphanedDrops로 돌려준다 —
 * 컬렉션이 빠져도 "중복 n개" 합계에서 조용히 사라지면 안 된다.
 */
function collectCollections(
  spaceFolder: SourceNode, seen: Set<string>, config: ImportConfig,
): { collections: PlannedCollection[]; orphanedDrops: number } {
  const own = emptyBucket(spaceFolder.id, SHARED_COLLECTION_TITLE, true);
  const subs: PlannedCollection[] = [];

  const walk = (folder: SourceNode, bucket: PlannedCollection | null, prefix: string) => {
    for (const child of folder.children ?? []) {
      if (!isFolder(child)) { consumeLink(child, bucket, seen); continue; }
      // 스페이스 폴더 기준 상대 경로 전체 — 경로는 유일하므로 이름이 충돌하지 않는다
      const title = prefix ? `${prefix}/${child.title}` : child.title;
      const b = config.enabled[child.id] ? emptyBucket(child.id, title, prefix !== "") : null;
      if (b) subs.push(b);
      // 꺼진 폴더의 직속 링크는 소비하지 않지만(중복 선점 금지), 자손은 독립적으로 켤 수 있다
      walk(child, b, title);
    }
  };
  walk(spaceFolder, own, "");

  const candidates = [...subs, own];
  return {
    collections: candidates.filter((c) => c.links.length > 0),
    orphanedDrops: candidates.filter((c) => c.links.length === 0)
      .reduce((n, c) => n + c.duplicatesDropped, 0),
  };
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
  let orphanedDrops = 0;

  for (const root of roots) {
    const looseId = looseSourceId(root.id);
    const loose = config.enabled[looseId]
      ? emptyBucket(looseId, SHARED_COLLECTION_TITLE, true)
      : null;

    // 루트 자식들을 문서 순서대로 — 루트 직속 링크와 1단 폴더가 섞여 있어도 선점 순서가 보이는 순서와 같다
    for (const child of root.children ?? []) {
      if (!isFolder(child)) { consumeLink(child, loose, seen); continue; }
      if (!config.enabled[child.id]) continue; // 꺼진 스페이스는 자손까지 통째로 빠진다
      const sub = collectCollections(child, seen, config);
      orphanedDrops += sub.orphanedDrops;
      if (sub.collections.length) {
        spaces.push({ sourceId: child.id, name: child.title, collections: sub.collections });
      }
    }
    // 루트 직속 링크 → 루트 이름의 스페이스. 표시 순서상 폴더들 뒤에 붙는다.
    if (loose && loose.links.length) {
      spaces.push({ sourceId: looseId, name: root.title, collections: [loose] });
    } else if (loose) {
      orphanedDrops += loose.duplicatesDropped;
    }
  }

  const totals = tally(spaces);
  // 만들어지지 않은 컬렉션에서 버려진 중복까지 합계에 남긴다 — 조용히 사라지면 안 된다
  totals.duplicates += orphanedDrops;
  return { spaces, totals };
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
