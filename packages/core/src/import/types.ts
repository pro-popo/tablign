/** 소스(Chrome·Toby) 트리를 정규화한 공통 형태. url이 있으면 링크, 없으면 폴더. */
export interface SourceNode {
  id: string;
  title: string;
  url?: string;
  children?: SourceNode[];
  /** 루트 노드에만 씀. 사용자가 매일 보는 루트(Chrome의 북마크바)인지. 기본 선택값 계산에 쓴다. */
  primary?: boolean;
}

export interface ImportConfig {
  /** 폴더 id(및 루트 직속 묶음 id) → 가져올지. defaultEnabled()가 초기값을 만든다. */
  enabled: Record<string, boolean>;
}

export interface PlannedLink {
  url: string;
  title: string | null;
  favicon_url: string | null;
}

export interface PlannedCollection {
  /** 출처 폴더 id. 공유 폴더면 그 스페이스 폴더(또는 루트 직속 묶음) id. */
  sourceId: string;
  title: string;
  /** 원본에 없던, 가져오기가 만들어낸 컬렉션(공유 폴더 / 이름 합침) */
  synthetic: boolean;
  links: PlannedLink[];
  /** 중복으로 버려진 개수. UI의 −n 배지. */
  duplicatesDropped: number;
}

export interface PlannedSpace {
  sourceId: string;
  name: string;
  collections: PlannedCollection[];
}

export interface ImportPlan {
  spaces: PlannedSpace[];
  totals: { spaces: number; collections: number; links: number; duplicates: number };
}
