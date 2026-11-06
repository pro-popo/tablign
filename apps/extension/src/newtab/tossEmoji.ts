import emojiData from "@emoji-mart/data";

/** 토스페이스 커버 범위(Unicode 14.0). emoji-mart 데이터의 version 필드 기준.
 *  주의: 이는 폰트의 실제 unicode-range가 아니라 근사치다 — version<=14라도 Tossface가
 *  선언한 범위 밖 글리프는 시스템 이모지로 fallback될 수 있다(실무상 잔여 불일치는 작음). */
const MAX_VERSION = 14;

/** 카테고리 id → 대표 탭 이모지. 여기 없는 카테고리(frequent 등)는 제외된다. 이름은 사전 tossEmoji.categories */
const CAT_TABS = {
  people: "😀",
  nature: "🐻",
  foods: "🍔",
  activity: "⚽",
  places: "✈️",
  objects: "💡",
  symbols: "❤️",
  flags: "🏳️",
};
export type TossCategoryId = keyof typeof CAT_TABS;
const isCategoryId = (id: string): id is TossCategoryId => id in CAT_TABS;

export interface TossEmoji {
  native: string;
  name: string;
  /** keywords + name 을 이어붙인 소문자 검색 인덱스. */
  search: string;
}
export interface TossCategory {
  id: TossCategoryId;
  tab: string;
  items: TossEmoji[];
}

interface RawEmoji {
  name?: string;
  keywords?: string[];
  version?: number;
  skins?: { native?: string }[];
}
interface RawData {
  categories?: { id: string; emojis: string[] }[];
  emojis?: Record<string, RawEmoji>;
}

/** @emoji-mart/data 에서 토스 커버 범위(version<=14)만 뽑아 카테고리 구조로 반환. */
export function buildTossCategories(data: unknown = emojiData): TossCategory[] {
  const d = data as RawData;
  const out: TossCategory[] = [];
  for (const c of d.categories ?? []) {
    if (!isCategoryId(c.id)) continue;
    const items: TossEmoji[] = [];
    for (const id of c.emojis ?? []) {
      const e = d.emojis?.[id];
      const native = e?.skins?.[0]?.native;
      if (!native) continue;
      if ((e?.version ?? 1) > MAX_VERSION) continue;
      const search = `${(e?.keywords ?? []).join(" ")} ${e?.name ?? ""}`.toLowerCase();
      items.push({ native, name: e?.name ?? id, search });
    }
    if (items.length) out.push({ id: c.id, tab: CAT_TABS[c.id], items });
  }
  return out;
}
