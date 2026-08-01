import { faviconFor } from "./url";
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

/** 루트 직속 링크 묶음(스페이스이자 컬렉션). 실제 폴더가 아니므로 합성 id를 쓴다. */
export function looseSourceId(rootId: string): string {
  return `${rootId}:loose`;
}

/**
 * 폴더 직속 링크 묶음(공유 폴더)의 컬렉션 키.
 * 폴더 id를 그대로 쓰면 그 폴더가 만드는 다른 컬렉션과 구분되지 않아,
 * 사용자가 공유 폴더만 따로 끄고 켤 수 없다.
 */
export function directSourceId(folderId: string): string {
  return `${folderId}:direct`;
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

function toLink(node: SourceNode): PlannedLink {
  return {
    url: node.url!,
    title: node.title || null,
    // 소스가 파비콘을 알고 있으면(Toby favIconUrl) 유추보다 그것을 신뢰한다
    favicon_url: node.favicon ?? faviconFor(node.url!),
  };
}

/** 폴더에 직접 들어있는 링크들(자손 폴더 것은 제외). */
function directLinks(folder: SourceNode): PlannedLink[] {
  const out: PlannedLink[] = [];
  for (const c of folder.children ?? []) if (!isFolder(c)) out.push(toLink(c));
  return out;
}

/**
 * 소스 트리가 만들 수 있는 스페이스·컬렉션의 **전체 윤곽**. 선택 상태와 무관하다.
 *
 * UI가 이걸 쓴다 — 스페이스를 전부 꺼도 목록에서 사라지면 안 되고(다시 켤 수 없게 된다),
 * 레일은 꺼진 스페이스까지 보여줘야 하기 때문이다.
 * `planImport`는 이 윤곽을 선택 상태로 거른 결과라, 미리보기와 실제 삽입이 어긋날 수 없다.
 *
 * 규칙:
 * - 1단 폴더 = 스페이스, 그 자손 폴더 = 컬렉션(이름은 스페이스 기준 상대 경로 전체)
 * - 폴더 직속 링크 = `공유 폴더` 컬렉션(키는 `<폴더id>:direct`)
 * - 루트 직속 링크 = 루트 이름의 스페이스 + `공유 폴더` 하나(키는 `<루트id>:loose`)
 * - 링크가 0개인 컬렉션, 컬렉션이 0개인 스페이스는 만들지 않는다
 */
export function outlineSpaces(roots: SourceNode[]): PlannedSpace[] {
  const spaces: PlannedSpace[] = [];

  for (const root of roots) {
    for (const child of root.children ?? []) {
      if (!isFolder(child)) continue;
      const collections: PlannedCollection[] = [];

      const walk = (folder: SourceNode, prefix: string) => {
        for (const g of folder.children ?? []) {
          if (!isFolder(g)) continue;
          // 스페이스 폴더 기준 상대 경로 전체 — 경로는 유일하므로 이름이 충돌하지 않는다
          const title = prefix ? `${prefix}/${g.title}` : g.title;
          const links = directLinks(g);
          if (links.length) {
            collections.push({ sourceId: g.id, title, synthetic: prefix !== "", links });
          }
          walk(g, title);
        }
      };
      walk(child, "");

      // 공유 폴더는 자손 컬렉션 뒤에 붙는다
      const own = directLinks(child);
      if (own.length) {
        collections.push({
          sourceId: directSourceId(child.id), title: SHARED_COLLECTION_TITLE,
          synthetic: true, links: own,
        });
      }

      if (collections.length) {
        spaces.push({ sourceId: child.id, name: child.title, collections });
      }
    }

    // 루트 직속 링크 → 루트 이름의 스페이스. 표시 순서상 폴더들 뒤에 붙는다.
    const loose = directLinks(root);
    if (loose.length) {
      const id = looseSourceId(root.id);
      spaces.push({
        sourceId: id, name: root.title,
        collections: [{
          sourceId: id, title: SHARED_COLLECTION_TITLE, synthetic: true, links: loose,
        }],
      });
    }
  }

  return spaces;
}

function tally(spaces: PlannedSpace[]): ImportPlan["totals"] {
  let collections = 0, links = 0;
  for (const s of spaces) {
    for (const c of s.collections) {
      collections += 1;
      links += c.links.length;
    }
  }
  return { spaces: spaces.length, collections, links };
}

/**
 * 소스 트리 + 선택 상태 → 실제로 만들어질 계획.
 * 윤곽을 컬렉션 단위로 거를 뿐이라, 화면이 보여주는 것과 서버로 보내는 것이 같다.
 */
export function planImport(roots: SourceNode[], config: ImportConfig): ImportPlan {
  const spaces: PlannedSpace[] = [];

  for (const sp of outlineSpaces(roots)) {
    const collections = sp.collections.filter((c) => !!config.enabled[c.sourceId]);
    if (collections.length) spaces.push({ ...sp, collections });
  }

  return { spaces, totals: tally(spaces) };
}

/**
 * 다이얼로그가 열린 순간의 체크 상태. 키는 **컬렉션 단위**다.
 * - 사용자가 매일 보는 루트(primary, Chrome의 북마크바) 아래만 기본으로 켠다.
 *   나머지 루트(기타 북마크·모바일 북마크)는 사실상 창고다.
 * - 자손 포함 링크가 LARGE_FOLDER_THRESHOLD를 넘는 1단 폴더는 통째로 끈다.
 *   대개 "나중에 읽기" 같은 묘지라서, 켜면 첫 보드가 못 쓰게 된다.
 */
export function defaultEnabled(roots: SourceNode[]): Record<string, boolean> {
  const bySpace = new Map<string, boolean>();

  for (const root of roots) {
    const primary = root.primary === true;
    for (const child of root.children ?? []) {
      if (!isFolder(child)) continue;
      bySpace.set(child.id, primary && countLinks(child) <= LARGE_FOLDER_THRESHOLD);
    }
    bySpace.set(looseSourceId(root.id), primary);
  }

  const enabled: Record<string, boolean> = {};
  for (const sp of outlineSpaces(roots)) {
    const on = bySpace.get(sp.sourceId) ?? false;
    for (const c of sp.collections) enabled[c.sourceId] = on;
  }
  return enabled;
}
